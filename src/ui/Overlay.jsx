import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';

// Libellés dans la voix « Mise en Place » du portfolio (table VOICE)
export const ZONES = [
  { id: 'drawers', label: 'Plats Signatures — les tiroirs' },
  { id: 'skills', label: 'Les Ingrédients — la saladette' },
  { id: 'board', label: 'La Brigade — le parcours' },
  { id: 'shelf', label: 'Le Chef — livre de recettes' },
  { id: 'pass', label: 'Réservations — le passe' },
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
  froid: '🧊 Chambre froide — la galerie des projets',
  salle: '🍽️ La salle — entrez, la carte vous attend',
};

export function Overlay({ onClassic }) {
  const view = useSceneStore((s) => s.view);
  const hovered = useSceneStore((s) => s.hovered);
  const goOverview = useSceneStore((s) => s.goOverview);
  const goFocus = useSceneStore((s) => s.goFocus);
  const enter = useSceneStore((s) => s.enter);
  const muted = useSceneStore((s) => s.muted);
  const setMuted = useSceneStore((s) => s.setMuted);
  const rush = useSceneStore((s) => s.rush);

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
