import { useSteakStore, DONENESS, BURN_TOTAL, labelOf } from '../game/useSteakStore';
import { useSceneStore } from '../store/useSceneStore';

// HUD du mini-jeu « cuire le steak » — habillé en bon de commande (même DA que
// les tickets du passe). Docké à droite pour ne pas masquer la poêle, cadrée à
// gauche. Le steak lui-même se clique en 3D (lancer / retourner) ; ce panneau
// double les commandes en boutons DOM (mobile, accessibilité) et lit la jauge.

const GAUGE_MAX = 2.0; // fin de barre : un peu au-delà du seuil « carbonisé »
const SEG_START = [0, ...DONENESS.map((d) => d.max)]; // bornes des bandes

// Bandes de cuisson en segments proportionnels (la dernière, ∞, clipée à la barre)
function bands() {
  return DONENESS.map((d, i) => {
    const from = SEG_START[i];
    const to = Math.min(d.max, GAUGE_MAX);
    return { key: d.key, label: d.label, color: d.color, left: (from / GAUGE_MAX) * 100, width: ((to - from) / GAUGE_MAX) * 100 };
  });
}

function Stars({ n }) {
  return (
    <span className="steak-stars" aria-label={`${n} sur 3`}>
      {'★★★'.slice(0, n)}
      <span className="steak-stars-off">{'★★★'.slice(n)}</span>
    </span>
  );
}

export function SteakHUD() {
  const phase = useSteakStore((s) => s.phase);
  const order = useSteakStore((s) => s.order);
  const table = useSteakStore((s) => s.table);
  const cookA = useSteakStore((s) => s.cookA);
  const cookB = useSteakStore((s) => s.cookB);
  const flips = useSteakStore((s) => s.flips);
  const result = useSteakStore((s) => s.result);
  const flip = useSteakStore((s) => s.flip);
  const serve = useSteakStore((s) => s.serve);
  const start = useSteakStore((s) => s.start);
  const reset = useSteakStore((s) => s.reset);

  if (phase === 'idle') return null;

  const total = cookA + cookB;
  const needle = Math.min(100, (total / GAUGE_MAX) * 100);
  const orderBand = bands().find((b) => b.key === order);

  const quit = () => {
    reset();
    useSceneStore.getState().goOverview();
  };

  return (
    <aside
      className="steak-dock"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <article className="ticket steak-ticket">
        <p className="steak-kicker">◆ Coup de feu ◆</p>
        <p className="steak-order">
          Table {table} — <strong>steak {labelOf(order)}</strong>
        </p>

        {/* Jauge de cuisson : bandes colorées + repère de la commande + aiguille */}
        <div className="steak-gauge" role="img" aria-label={`Cuisson : ${labelOf(order)} demandé`}>
          <div className="steak-gauge-bar">
            {bands().map((b) => (
              <span
                key={b.key}
                className="steak-band"
                style={{ left: `${b.left}%`, width: `${b.width}%`, '--band': b.color }}
                title={b.label}
              />
            ))}
            {orderBand && (
              <span
                className="steak-target"
                style={{ left: `${orderBand.left}%`, width: `${orderBand.width}%` }}
                aria-hidden="true"
              />
            )}
            <span className="steak-needle" style={{ left: `${needle}%` }} aria-hidden="true" />
          </div>
          <div className="steak-gauge-labels">
            {DONENESS.slice(0, 4).map((d) => (
              <span key={d.key} className={d.key === order ? 'is-target' : ''}>
                {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* Les deux faces : saisir les deux → cuisson régulière */}
        <div className="steak-faces">
          {[cookA, cookB].map((c, i) => (
            <div key={i} className="steak-face">
              <span className="steak-face-name">Face {i === 0 ? 'A' : 'B'}</span>
              <span className="steak-face-bar">
                <span style={{ width: `${Math.min(100, (c / 1.0) * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>

        {phase === 'cooking' ? (
          <>
            <p className="steak-hint">
              {flips === 0
                ? 'Cliquez le steak pour le retourner à mi-cuisson…'
                : 'Envoyez à la cuisson commandée — pas une seconde de trop !'}
            </p>
            <div className="steak-actions">
              <button className="btn steak-flip" onClick={flip}>
                ↻ Retourner
              </button>
              <button className="btn btn-primary steak-serve" onClick={serve}>
                🔔 Envoyer !
              </button>
            </div>
          </>
        ) : (
          result && (
            <div className={`steak-result ${result.ok ? 'is-ok' : 'is-ko'}`}>
              <Stars n={result.stars} />
              <p className="steak-result-title">{result.title}</p>
              <p className="steak-result-msg">{result.msg}</p>
              <div className="steak-actions">
                <button className="btn btn-primary" onClick={start}>
                  Nouvelle commande
                </button>
                <button className="btn" onClick={quit}>
                  Quitter le piano
                </button>
              </div>
            </div>
          )
        )}
      </article>
    </aside>
  );
}
