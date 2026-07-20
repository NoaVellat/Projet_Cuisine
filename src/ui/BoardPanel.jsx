import { CONTENT } from '../content/content';
import { TicketBody, Chips } from './TicketBits';

// La Brigade — états de service (tableau). Même contenu que le ticket 3D
// ancré sur le tableau (Kitchen.jsx) ; extrait pour le dock mobile.
export function BoardPanel() {
  return (
    <TicketBody kicker="La Brigade" title="États de service" footer="ancienneté vérifiée">
      <ul className="timeline">
        {CONTENT.about.timeline.map((t) => (
          <li key={t.year}>
            <strong>{t.year}</strong>
            <span className="timeline-role">{t.title}</span> — {t.sub}
            {t.detail && <em className="ticket-detail">{t.detail}</em>}
          </li>
        ))}
      </ul>
      <Chips items={CONTENT.about.tags} />
    </TicketBody>
  );
}
