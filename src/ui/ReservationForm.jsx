import { useState } from 'react';
import { CONTENT } from '../content/content';

// Formulaire de « réservation » (= prise de contact) partagé entre la salle 3D
// et le mode classique. Envoie via un mailto pré-rempli (aucun backend requis).
// `variant` = 'paper' (ticket de la salle) ou 'dark' (mode classique).
export function ReservationForm({ variant = 'dark' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const c = CONTENT.contact;

  const mailto =
    `mailto:${c.email}` +
    `?subject=${encodeURIComponent('Réservation — ' + (name || 'via Le Poste'))}` +
    `&body=${encodeURIComponent(`${msg}\n\n— ${name}${email ? ' · ' + email : ''}`)}`;

  return (
    <form
      className={`resa-form resa-${variant}`}
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = mailto; // ouvre le client mail pré-rempli
        setSent(true); // retour visuel : on confirme ce qui vient de se passer
      }}
    >
      <div className="resa-row">
        <input
          aria-label="Votre nom"
          placeholder="Votre nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          aria-label="Votre email"
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <textarea
        aria-label="Votre message"
        placeholder="Votre projet, une opportunité, un bonjour…"
        rows={3}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
      />
      <button type="submit">Réserver une table&nbsp;✉</button>
      {sent && (
        <p className="resa-sent" role="status">
          ✉ Votre client mail s'ouvre avec la réservation pré-remplie. Rien ne
          s'ouvre ? Écrivez directement à{' '}
          <a href={`mailto:${c.email}`}>{c.email}</a>.
        </p>
      )}
    </form>
  );
}
