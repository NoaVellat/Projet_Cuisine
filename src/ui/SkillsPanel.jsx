import { CONTENT } from '../content/content';
import { useSceneStore } from '../store/useSceneStore';

const BAC_COLORS = ['#c0392b', '#5a8a3c', '#c8a636', '#a89a7c', '#c9762e'];

// Carte « Les Ingrédients » de la saladette : dockée en DOM (comme la salle)
// plutôt que projetée en 3D — l'ancienne version, ancrée à un point de la
// scène, pouvait s'enfoncer sous le bas de l'écran une fois agrandie (le
// body coupe tout ce qui dépasse). Le dock est toujours entièrement visible.
export function SkillsPanel() {
  const bacIndex = useSceneStore((s) => s.bacIndex);
  const setBac = useSceneStore((s) => s.setBac);
  const bac = CONTENT.skills[bacIndex];
  const color = BAC_COLORS[bacIndex];
  return (
    <article className="ticket skills-ticket" role="dialog" aria-label="Les Ingrédients — la saladette">
      <header className="ticket-head">
        <p className="ticket-brand">◆ Le Poste — cuisine du chef ◆</p>
        <p className="ticket-kicker">Les Ingrédients</p>
        <h2>La saladette</h2>
      </header>

      <div className="bac-tabs" role="tablist">
        {CONTENT.skills.map((s, i) => (
          <button
            key={s.bac}
            role="tab"
            aria-selected={i === bacIndex}
            className={i === bacIndex ? 'on' : ''}
            style={
              i === bacIndex
                ? { background: BAC_COLORS[i], borderColor: BAC_COLORS[i], color: '#fdf9ef' }
                : { borderColor: BAC_COLORS[i], color: '#4a423a' }
            }
            onClick={() => setBac(i)}
          >
            {s.bac}
          </button>
        ))}
      </div>

      <h3 style={{ color }}>{bac.poste}</h3>
      <div className="chips">
        {bac.items.map((t) => (
          <span className="chip" key={t} style={{ borderColor: color, color, background: `${color}14` }}>
            {t}
          </span>
        ))}
      </div>
      <p className="ticket-note">
        Chaque bac de la saladette est cliquable — comme les légumes du billot.
      </p>

      <div className="barcode" aria-hidden="true" />
      <p className="ticket-foot">produits frais · maison</p>
    </article>
  );
}
