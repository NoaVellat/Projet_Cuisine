import { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';
import { SallePanel } from './SallePanel';
import { SkillsPanel } from './SkillsPanel';
import { BoardPanel } from './BoardPanel';
import { ContactPanel } from './ContactPanel';
import { ChefPanel } from './ChefPanel';
import { sfx } from '../audio/sfx';

const MOBILE_DOCK_PANELS = {
  board: BoardPanel,
  pass: ContactPanel,
  shelf: ChefPanel,
};

// Répète les pastilles 3D de Kitchen.jsx (HOTSPOTS) mais en menu DOM fixe :
// sur un écran étroit, projeter 7 étiquettes en 3D les fait toutes se
// chevaucher (le cadrage a été calé pour du 16:9 desktop). Un menu fixe ne
// dépend d'aucune projection caméra — jamais de chevauchement, quelle que
// soit la taille d'écran. Bascule CSS pure (cf. .mobile-zone-menu / .hotspot
// dans le media query mobile) : les deux sont toujours montés, un seul visible.
const MOBILE_ZONES = [
  { zone: 'drawers', label: 'Les projets' },
  { zone: 'skills', label: 'Compétences' },
  { zone: 'board', label: 'Le parcours' },
  { zone: 'shelf', label: 'Le chef' },
  { zone: 'pass', label: 'Contact' },
  { zone: 'cv', label: 'Mon CV' },
  { zone: 'laptop', label: 'Mode classique' },
];

// Libellés dans la voix « Mise en Place » du portfolio (table VOICE)
export const ZONES = [
  { id: 'drawers', label: 'Plats Signatures — les tiroirs' },
  { id: 'skills', label: 'Les Ingrédients — la saladette' },
  { id: 'board', label: 'La Brigade — le parcours' },
  { id: 'shelf', label: 'Le Chef — livre de recettes' },
  { id: 'pass', label: 'Service ! — contact au passe' },
];

const HOVER_LABELS = {
  ...Object.fromEntries(ZONES.map((z) => [z.id, z.label])),
  cv: 'Ticket CV — imprimer',
  entry: 'Pousser les portes',
  laptop: 'Le portable du chef — mode classique',
  duck: '🦆 Canard de debug — expliquez-lui votre bug',
  lamp: 'La lampe du passe',
  pot: '🍲 Ça mijote…',
  notes: '🎵 La batterie — jouez un air (métal)',
  glass: '🎵 Les bocaux — timbre cristal',
  veg: '🔪 La mise en place — un légume, une stack',
  salle: '🍽️ La salle — passez les portières',
  bell: '🛎️ Sonnez — le service arrive',
  champ: '🍾 Le champagne du succès',
};

export function Overlay({ onClassic }) {
  const view = useSceneStore((s) => s.view);
  const zoneId = useSceneStore((s) => s.zoneId);
  const hovered = useSceneStore((s) => s.hovered);
  const goOverview = useSceneStore((s) => s.goOverview);
  const goFocus = useSceneStore((s) => s.goFocus);
  const enter = useSceneStore((s) => s.enter);
  const muted = useSceneStore((s) => s.muted);
  const setMuted = useSceneStore((s) => s.setMuted);
  const rush = useSceneStore((s) => s.rush);
  // Tactile : ni souris à « bouger », ni touche Entrée/Échap au clavier —
  // les libellés s'adaptent (retours UX : le texte desktop n'avait aucun sens sur mobile).
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  const onMobileZone = (zone) => {
    if (zone === 'cv') {
      window.open(CONTENT.identity.cvUrl, '_blank', 'noopener,noreferrer');
    } else if (zone === 'laptop') {
      sfx.tick();
      useSceneStore.getState().bootClassic();
    } else {
      goFocus(zone);
    }
  };

  // Panneau de bienvenue : une seule fois, à la 1re arrivée en vue d'ensemble.
  // Invite à balayer le poste (souris) et à tout regarder avant de plonger.
  const [welcome, setWelcome] = useState(false);
  const welcomedOnce = useRef(false);
  useEffect(() => {
    if (view === 'overview' && !welcomedOnce.current) {
      welcomedOnce.current = true;
      setWelcome(true);
    } else if (view !== 'overview') {
      setWelcome(false);
    }
  }, [view]);

  return (
    <>
      <header className="hud hud-top">
        <div className="brand">
          <strong>{CONTENT.identity.name}</strong>
          <span>{CONTENT.identity.role}</span>
        </div>
        <div className="hud-actions">
          <button
            className="btn btn-icon"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            title={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <a className="btn" href={CONTENT.identity.cvUrl} download>
            CV
          </a>
          <button className="btn" onClick={onClassic}>
            Mode classique
          </button>
        </div>
      </header>

      {/* Navigation clavier : boutons focusables superposés, un par zone */}
      <nav className="zone-nav" aria-label="Zones du poste">
        {ZONES.map((z) => (
          <button key={z.id} className="sr-focusable" onClick={() => goFocus(z.id)}>
            {z.label}
          </button>
        ))}
      </nav>

      {/* Menu mobile : remplace les pastilles 3D sur petit écran (cf. commentaire
          plus haut) — masqué par défaut, visible via le media query mobile. */}
      {view === 'overview' && (
        <nav className="mobile-zone-menu" aria-label="Zones du poste">
          {MOBILE_ZONES.map((z) => (
            <button key={z.zone} className="mobile-zone-chip" onClick={() => onMobileZone(z.zone)}>
              {z.label}
            </button>
          ))}
        </nav>
      )}

      {/* Accès à la salle du restaurant : sa porte est hors cadre en vue
          d'ensemble, ce repère (DOM, clic fiable) y mène. */}
      {view === 'overview' && (
        <button className="room-marker" onClick={() => goFocus('salle')}>
          🍽️ La Salle · Réservations →
        </button>
      )}

      {/* Dans la salle : le panneau réservations est docké à droite (il ne
          masque donc pas le serveur, cadré à gauche). stopPropagation : aucun
          clic sur le panneau ne doit atteindre le canvas (→ goBack). */}
      {view === 'focus' && zoneId === 'salle' && (
        <aside
          className="salle-dock"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <SallePanel />
        </aside>
      )}

      {/* Les Ingrédients : dockée en DOM (comme la salle) pour ne jamais
          s'enfoncer sous le bas de l'écran quel que soit le cadrage caméra. */}
      {view === 'focus' && zoneId === 'skills' && (
        <aside
          className="skills-dock"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <SkillsPanel />
        </aside>
      )}

      {/* Board/pass/shelf : équivalent mobile du ticket 3D (cf. FocusPanel
          dans Kitchen.jsx, masqué en dessous de 560px) — même contenu,
          docké plein écran plutôt que projeté (jamais de débordement). */}
      {view === 'focus' && MOBILE_DOCK_PANELS[zoneId] && (
        <div
          className="ticket-mobile-dock"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const Panel = MOBILE_DOCK_PANELS[zoneId];
            return (
              <article className="ticket">
                <Panel />
              </article>
            );
          })()}
        </div>
      )}

      {/* Bienvenue : vue d'ensemble avant de plonger — on invite à tout regarder */}
      {welcome && view === 'overview' && (
        <div className="welcome" role="dialog" aria-label="Bienvenue">
          <div className="welcome-card">
            <p className="welcome-kicker">— Service ! Bienvenue en cuisine —</p>
            <p className="welcome-text">
              Voici le poste du chef. Prenez le temps de tout regarder :
              {coarse ? (
                <strong> baladez-vous du bout du doigt</strong>
              ) : (
                <strong> bougez la souris</strong>
              )}{' '}
              pour balayer la scène, puis
              {coarse ? (
                <strong> touchez le menu ci-dessous</strong>
              ) : (
                <strong> suivez les pastilles cuivrées</strong>
              )}{' '}
              — chacune mène à une partie du portfolio.
            </p>
            <button className="btn btn-lg" onClick={() => setWelcome(false)} autoFocus>
              Commencer le service
            </button>
          </div>
        </div>
      )}

      {/* Accueil : CTA d'entrée superposé au couloir (le nom est aussi en DOM) */}
      {view === 'entry' && (
        <div className="entry-cta">
          <p className="entry-kicker">— Cuisine du chef Noa Vellat —</p>
          <button className="btn btn-lg" onClick={enter} autoFocus>
            Pousser les portes
          </button>
          <p className="entry-hint">
            {CONTENT.identity.dispo}
            {!coarse && ' · ou touche Entrée'}
          </p>
        </div>
      )}

      <footer className="hud hud-bottom">
        {view === 'entry' ? null : view !== 'overview' ? (
          <button className="btn" onClick={goOverview}>
            ← Retour au poste
          </button>
        ) : (
          <span className="hint">
            {rush
              ? '🔥 Coup de feu ! Service !'
              : HOVER_LABELS[hovered] ??
                (coarse ? 'Touchez une zone du poste' : 'Cliquez une zone du poste · Échap pour revenir')}
          </span>
        )}
      </footer>
    </>
  );
}
