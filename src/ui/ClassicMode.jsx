import { CONTENT } from '../content/content';

// Fallback HTML complet : tout le contenu accessible sans WebGL.
export function ClassicMode({ onBack }) {
  const c = CONTENT.contact;
  return (
    <div className="classic">
      <header className="classic-header">
        <div>
          <h1>{CONTENT.identity.name}</h1>
          <p>{CONTENT.identity.role}</p>
          <p>{CONTENT.identity.pitch}</p>
        </div>
        <nav>
          <a href="#projets">Plats Signatures</a>
          <a href="#skills">Les Ingrédients</a>
          <a href="#about">Le Chef</a>
          <a href="#contact">Réservations</a>
          <a href={CONTENT.identity.cvUrl} download>
            CV
          </a>
          <button className="btn" onClick={onBack}>
            Vue 3D
          </button>
        </nav>
      </header>

      <main>
        <section id="projets">
          <h2>Plats Signatures</h2>
          {CONTENT.projects.map((p) => (
            <article key={p.id} className="classic-card">
              <p className="tech">{p.course}</p>
              <h3>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.title} ↗
                </a>
              </h3>
              <p>{p.desc}</p>
              <p className="tech">{p.tech.join(' · ')}</p>
            </article>
          ))}
          <p>
            <a href={CONTENT.projectsCTA.url} target="_blank" rel="noreferrer">
              {CONTENT.projectsCTA.label} →
            </a>
          </p>
        </section>

        <section id="skills">
          <h2>Les Ingrédients</h2>
          {CONTENT.skills.map((s) => (
            <div key={s.poste}>
              <h3>{s.poste}</h3>
              <p>{s.items.join(' · ')}</p>
            </div>
          ))}
        </section>

        <section id="about">
          <h2>Le Chef</h2>
          {CONTENT.about.paras.map((p) => (
            <p key={p.slice(0, 16)}>{p}</p>
          ))}
          <blockquote>« {CONTENT.about.quote} »</blockquote>
          <ul>
            {CONTENT.about.timeline.map((t) => (
              <li key={t.year}>
                <strong>{t.year}</strong> — {t.title} · {t.sub}
              </li>
            ))}
          </ul>
        </section>

        <section id="contact">
          <h2>Réservations</h2>
          <p>{c.pitch}</p>
          <ul>
            <li>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </li>
            <li>
              <a href={`tel:+33${c.telHref.slice(1)}`}>{c.tel}</a>
            </li>
            <li>
              <a href={c.github.url}>GitHub — {c.github.handle}</a>
            </li>
            <li>
              <a href={c.linkedin.url}>LinkedIn — {c.linkedin.handle}</a>
            </li>
          </ul>
          <p>{CONTENT.identity.dispo}</p>
        </section>
      </main>
    </div>
  );
}
