import { useState } from 'react';
import { CONTENT } from '../content/content';

// Formulaire de « réservation » (= prise de contact) partagé entre la salle 3D
// et le mode classique. Envoi RÉEL sans backend : POST AJAX vers FormSubmit
// (https://formsubmit.co) — le visiteur n'a besoin d'AUCUN client mail
// configuré. Si le service ne répond pas (réseau, adblock…), repli
// automatique sur un mailto pré-rempli. `variant` = 'paper' | 'dark'.
export function ReservationForm({ variant = 'dark' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | fallback
  const c = CONTENT.contact;

  const mailto =
    `mailto:${c.email}` +
    `?subject=${encodeURIComponent('Réservation — ' + (name || 'via Le Poste'))}` +
    `&body=${encodeURIComponent(`${msg}\n\n— ${name}${email ? ' · ' + email : ''}`)}`;

  const submit = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${c.email}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message: msg,
          _subject: `Réservation — ${name || 'via Le Poste'}`,
          _template: 'table',
          _captcha: 'false',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === 'false') throw new Error('refus');
      setStatus('sent');
    } catch {
      // Service injoignable → on ouvre le client mail du visiteur, pré-rempli
      window.location.href = mailto;
      setStatus('fallback');
    }
  };

  return (
    <form className={`resa-form resa-${variant}`} onSubmit={submit}>
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
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi en cours…' : 'Réserver une table ✉'}
      </button>
      {status === 'sent' && (
        <p className="resa-sent" role="status">
          ✅ Réservation reçue — je reviens vers vous sous 24 h, promis. Merci !
        </p>
      )}
      {status === 'fallback' && (
        <p className="resa-sent" role="status">
          ✉ Le service d'envoi n'a pas répondu : votre client mail s'ouvre avec
          le message pré-rempli. Sinon, écrivez directement à{' '}
          <a href={`mailto:${c.email}`}>{c.email}</a>.
        </p>
      )}
    </form>
  );
}
