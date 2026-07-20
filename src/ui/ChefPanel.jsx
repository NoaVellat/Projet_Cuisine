import { CONTENT } from '../content/content';
import { TicketBody } from './TicketBits';

// Le Chef — récit de reconversion (étagère/livre). Même contenu que le
// ticket 3D ancré sur l'étagère (Kitchen.jsx) ; extrait pour le dock mobile.
export function ChefPanel() {
  return (
    <TicketBody kicker="Le Chef" title="De la brigade au terminal" footer="recette de la maison">
      {CONTENT.about.paras.map((p) => (
        <p key={p.slice(0, 16)}>{p}</p>
      ))}
      <p className="ticket-note">« {CONTENT.about.quote} »</p>
    </TicketBody>
  );
}
