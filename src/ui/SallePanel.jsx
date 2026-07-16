import { CONTENT } from '../content/content';
import { ReservationForm } from './ReservationForm';

// Carte « réservations » de la salle : le maître d'hôtel accueille d'une jolie
// phrase et propose de réserver (→ email). Rendue en DOM et dockée sur le
// côté droit (elle ne masque donc pas le serveur, cadré à gauche).
export function SallePanel() {
  const c = CONTENT.contact;
  return (
    <article className="ticket salle-ticket" role="dialog" aria-label="Réservations — la salle">
      <header className="ticket-head">
        <p className="ticket-brand">◆ Le Poste — la salle ◆</p>
        <p className="ticket-kicker">Accueil · réservations</p>
        <h2>Le maître d'hôtel vous accueille</h2>
      </header>

      <p className="ticket-note salle-hello">
        « Bonsoir, et bienvenue au Poste ! Une table pour ce soir ? Laissez-moi
        votre nom — je vous garde la meilleure place, près de la fenêtre. »
      </p>

      <h3 className="salle-h">Réserver une table</h3>
      <ReservationForm variant="paper" />
      <div className="contact-chips">
        <a href={`mailto:${c.email}`}>✉ Email</a>
        <a href={c.linkedin.url} target="_blank" rel="noreferrer">in LinkedIn</a>
      </div>

      <div className="barcode" aria-hidden="true" />
      <p className="ticket-foot">service du midi &amp; du soir</p>
    </article>
  );
}
