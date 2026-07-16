import { useEffect, useRef, useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';
import { SallePanel } from './SallePanel';

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

      {/* Bienvenue : vue d'ensemble avant de plonger — on invite à tout regarder */}
      {welcome && view === 'overview' && (
        <div className="welcome" role="dialog" aria-label="Bienvenue">
          <div className="welcome-card">
            <p className="welcome-kicker">— Service ! Bienvenue en cuisine —</p>
            <p className="welcome-text">
              Voici le poste du chef. Prenez le temps de tout regarder :
              <strong> bougez la souris</strong> pour balayer la scène. Chaque objet
              — tiroirs, saladette, tableau, passe, portes — est cliquable et mène à
              une partie du portfolio.
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
            {CONTENT.identity.dispo} · ou touche Entrée
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
              : HOVER_LABELS[hovered] ?? 'Cliquez une zone du poste · Échap pour revenir'}
          </span>
        )}
      </footer>
    </>
  );
}
