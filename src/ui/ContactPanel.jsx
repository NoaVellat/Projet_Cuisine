import { CONTENT } from '../content/content';
import { TicketBody } from './TicketBits';

// Service ! — contact au passe. Même contenu que le ticket 3D ancré sur le
// passe (Kitchen.jsx) ; extrait ici pour être docké en DOM sur mobile
// (cf. Overlay.jsx) sans dupliquer le texte.
export function ContactPanel() {
  const c = CONTENT.contact;
  return (
    <TicketBody kicker="— Service ! —" title="Le chef répond au passe" footer="réponse sous 24 h · lyon">
      <p>{c.pitch}</p>
      <div className="contact-list">
        <p className="contact-row">
          <span className="contact-k">✉ Email</span>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
        <p className="contact-row">
          <span className="contact-k">☎ Tél</span>
          <a href={`tel:+33${c.telHref.slice(1)}`}>{c.tel}</a>
        </p>
        <p className="contact-row">
          <span className="contact-k">⌥ GitHub</span>
          <a href={c.github.url} target="_blank" rel="noreferrer">
            {c.github.handle}
          </a>
        </p>
        <p className="contact-row">
          <span className="contact-k">in LinkedIn</span>
          <a href={c.linkedin.url} target="_blank" rel="noreferrer">
            {c.linkedin.handle}
          </a>
        </p>
        <p className="contact-row">
          <span className="contact-k">⎙ CV</span>
          <a href={CONTENT.identity.cvUrl} download>
            CV_Noa_Vellat.pdf
          </a>
        </p>
      </div>
      <p className="ticket-note">
        ⚠ Allergènes : bugs, code non testé &amp; deadlines floues — jamais servis dans cette maison.
      </p>
      <p className="stamp stamp-green">{CONTENT.identity.dispo}</p>
    </TicketBody>
  );
}
