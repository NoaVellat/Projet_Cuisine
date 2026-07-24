import { create } from 'zustand';
import { sfx, sizzleStart, sizzleStop } from '../audio/sfx';

// Mini-jeu « cuire le steak » (piano de cuisson).
//
// Une commande tombe (comme un bon au passe) : une table veut son steak d'une
// certaine cuisson. Le joueur clique le steak pour lancer la cuisson, le CLIQUE
// à nouveau pour le retourner (il faut saisir les DEUX faces), et l'envoie au
// bon moment. On note la justesse de cuisson ET la régularité de la saisie.
//
// Modèle : chaque face accumule de la chaleur quand elle est côté poêle (down).
// La « cuisson totale » = somme des deux faces → détermine la cuisson obtenue.
// La régularité = écart entre les deux faces (récompense le fait de retourner à
// mi-cuisson plutôt que de tout cuire d'un côté). L'authoritatif temps réel vit
// dans Kitchen.jsx (useFrame) ; ce store ne garde qu'un miroir pour l'affichage.

// Bandes de cuisson par chaleur totale (une face « juste saisie » ≈ 0,55).
export const DONENESS = [
  { key: 'bleu', label: 'Bleu', max: 0.62, color: '#c0303e' },
  { key: 'saignant', label: 'Saignant', max: 0.95, color: '#b6414a' },
  { key: 'apoint', label: 'À point', max: 1.35, color: '#9c5238' },
  { key: 'biencuit', label: 'Bien cuit', max: 1.85, color: '#6f4128' },
  { key: 'brule', label: 'Carbonisé', max: Infinity, color: '#2a211c' },
];
export const BURN_TOTAL = DONENESS[3].max; // au-delà : carbonisé, plat perdu

// Le chef n'envoie pas un bleu ni un carbonisé sur commande : on tire au sort
// entre les trois cuissons « nobles ».
const ORDERS = ['saignant', 'apoint', 'biencuit'];

export function bandOf(total) {
  return DONENESS.find((d) => total < d.max) ?? DONENESS[DONENESS.length - 1];
}

export const useSteakStore = create((set, get) => ({
  phase: 'idle', // 'idle' | 'cooking' | 'result'
  order: 'apoint', // cuisson commandée
  table: 3, // numéro de table (habillage)
  round: 0, // incrémenté à chaque partie → resync de la boucle de rendu
  down: 0, // face en contact avec la poêle (0 | 1)
  flips: 0,
  cookA: 0, // miroir d'affichage (mis à jour ~12 Hz par Kitchen.jsx)
  cookB: 0,
  result: null, // { stars, title, msg, ok }

  // Lance une partie : nouvelle commande, cuisson remise à zéro, grésil.
  start: () => {
    const order = ORDERS[Math.floor(Math.random() * ORDERS.length)];
    const table = 2 + Math.floor(Math.random() * 18);
    set((s) => ({ phase: 'cooking', order, table, round: s.round + 1, down: 0, flips: 0, cookA: 0, cookB: 0, result: null }));
    sizzleStart();
  },

  // Retourne le steak (clic sur la viande en cours de cuisson).
  flip: () => {
    if (get().phase !== 'cooking') return;
    set((s) => ({ down: s.down ? 0 : 1, flips: s.flips + 1 }));
    sfx.flipSteak();
  },

  // Miroir d'affichage depuis la boucle de rendu (throttlé côté appelant).
  setCook: (cookA, cookB) => set({ cookA, cookB }),

  // Envoi au passe : on fige, on note, on sonne le verdict.
  serve: () => {
    const s = get();
    if (s.phase !== 'cooking') return;
    sizzleStop();
    const total = s.cookA + s.cookB;
    const got = bandOf(total).key;
    const rawSide = Math.min(s.cookA, s.cookB) < 0.16; // une face crue
    const uneven = Math.abs(s.cookA - s.cookB) > 0.3; // saisi de travers
    const idx = (k) => DONENESS.findIndex((d) => d.key === k);
    const dist = Math.abs(idx(got) - idx(s.order));

    let result;
    if (got === 'brule') {
      result = { stars: 0, ok: false, title: 'Carbonisé !', msg: 'Le chef ne l’enverra jamais. Poubelle.' };
    } else if (got === s.order && !rawSide && !uneven) {
      result = { stars: 3, ok: true, title: 'Cuisson parfaite, chef !', msg: 'Saisie régulière, cuit à cœur. Envoyez !' };
    } else if (got === s.order && rawSide) {
      result = { stars: 1, ok: false, title: 'Cru d’un côté', msg: 'La bonne cuisson… mais une face pas saisie. On retourne à mi-cuisson !' };
    } else if (got === s.order) {
      result = { stars: 2, ok: true, title: 'Bien envoyé', msg: 'Bonne cuisson, saisie un peu inégale. Ça passe.' };
    } else if (dist === 1) {
      const sens = idx(got) < idx(s.order) ? 'un peu trop saignant' : 'un peu trop cuit';
      result = { stars: 1, ok: false, title: 'Presque', msg: `Commandé ${labelOf(s.order)}, envoyé ${sens}.` };
    } else {
      result = { stars: 0, ok: false, title: 'Raté', msg: `Commandé ${labelOf(s.order)}, envoyé ${labelOf(got)}. La table renvoie l’assiette.` };
    }
    set({ phase: 'result', result });
    if (result.stars >= 2) sfx.steakWin(result.stars);
    else sfx.steakFail();
  },

  // Retour à l'état initial (fin de partie, ou on quitte le poste).
  reset: () => {
    if (get().phase === 'cooking') sizzleStop();
    set({ phase: 'idle', down: 0, flips: 0, cookA: 0, cookB: 0, result: null });
  },
}));

export function labelOf(key) {
  return DONENESS.find((d) => d.key === key)?.label ?? key;
}
