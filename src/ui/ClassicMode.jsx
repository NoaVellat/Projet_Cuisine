import { CONTENT } from '../content/content';

// Fallback HTML complet — pensé comme la CARTE d'un restaurant gastronomique.
// Accessible sans WebGL, indexable, imprimable. Voix « Mise en Place ».
export function ClassicMode({ onBack }) {
  const c = CONTENT.contact;
  return (
    <div className="cl">
      <header className="cl-nav">
        <a href="#top" className="cl-logo">
          Le Poste<span>· cuisine du chef</span>
        </a>
        <nav>
          <a href="#carte">La Carte</a>
          <a href="#ingredients">Les Ingrédients</a>
          <a href="#chef">Le Chef</a>
          <a href="#reservations">Réservations</a>
        </nav>
        <div className="cl-nav-actions">
          <a className="cl-btn cl-btn-ghost" href={CONTENT.identity.cvUrl} download>
            ↓ CV
          </a>
          <button className="cl-btn" onClick={onBack}>
            ↩ Vue 3D
          </button>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="cl-hero">
          <p className="cl-kicker">◆ Ouvert · disponible en alternance sept. 2026</p>
          <h1>{CONTENT.identity.name}</h1>
          <p className="cl-role">{CONTENT.identity.role}</p>
          <p className="cl-pitch">{CONTENT.identity.pitch}</p>
          <div className="cl-hero-cta">
            <a className="cl-btn cl-btn-lg" href="#carte">
              Voir la carte
            </a>
            <a className="cl-btn cl-btn-lg cl-btn-ghost" href={`mailto:${c.email}`}>
              Réserver une table
            </a>
          </div>
          <ul className="cl-facts">
            <li><strong>6</strong> plats signatures</li>
            <li><strong>5</strong> langages</li>
            <li><strong>3</strong> ans de gastronomie</li>
            <li><strong>2027</strong> diplôme Epitech</li>
          </ul>
        </section>

        {/* LA CARTE — projets */}
        <section id="carte" className="cl-section">
          <div className="cl-shead">
            <span className="cl-snum">I</span>
            <h2>La Carte — plats signatures</h2>
            <p>Six projets, du travail au gramme près.</p>
          </div>
          <div className="cl-menu">
            {CONTENT.projects.map((p, i) => (
              <article key={p.id} className="cl-dish">
                <div className="cl-dish-head">
                  <span className="cl-dish-course">{p.course}</span>
                  <span className="cl-dish-num">0{i + 1}</span>
                </div>
                <h3>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.title} <span aria-hidden="true">↗</span>
                  </a>
                </h3>
                <p className="cl-dish-note">« {p.note} »</p>
                <p className="cl-dish-desc">{p.desc}</p>
                <ul className="cl-tags">
                  {p.tech.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <a className="cl-more" href={CONTENT.projectsCTA.url} target="_blank" rel="noreferrer">
            {CONTENT.projectsCTA.label} →
          </a>
        </section>

        {/* LES INGRÉDIENTS — skills */}
        <section id="ingredients" className="cl-section cl-section-alt">
          <div className="cl-shead">
            <span className="cl-snum">II</span>
            <h2>Les Ingrédients — compétences</h2>
            <p>La mise en place, par poste de la brigade.</p>
          </div>
          <div className="cl-bacs">
            {CONTENT.skills.map((s, i) => (
              <div key={s.bac} className="cl-bac" data-bac={i}>
                <h3>
                  <span className="cl-bac-tag">{s.bac}</span>
                  {s.poste}
                </h3>
                <ul className="cl-tags">
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* LE CHEF — about + parcours */}
        <section id="chef" className="cl-section">
          <div className="cl-shead">
            <span className="cl-snum">III</span>
            <h2>Le Chef — de la brigade au terminal</h2>
          </div>
          <div className="cl-chef">
            <div className="cl-chef-text">
              {CONTENT.about.paras.map((p) => (
                <p key={p.slice(0, 16)}>{p}</p>
              ))}
              <blockquote>« {CONTENT.about.quote} »</blockquote>
            </div>
            <ol className="cl-timeline">
              {CONTENT.about.timeline.map((t) => (
                <li key={t.year}>
                  <span className="cl-tl-year">{t.year}</span>
                  <div>
                    <strong>{t.title}</strong>
                    <span className="cl-tl-sub">{t.sub}</span>
                    {t.detail && <em>{t.detail}</em>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* RÉSERVATIONS — contact */}
        <section id="reservations" className="cl-section cl-section-alt">
          <div className="cl-shead">
            <span className="cl-snum">IV</span>
            <h2>Réservations</h2>
            <p>{c.pitch}</p>
          </div>
          <div className="cl-contact">
            <a href={`mailto:${c.email}`}><span>✉</span>{c.email}</a>
            <a href={`tel:+33${c.telHref.slice(1)}`}><span>☎</span>{c.tel}</a>
            <a href={c.github.url} target="_blank" rel="noreferrer"><span>⌥</span>GitHub · {c.github.handle}</a>
            <a href={c.linkedin.url} target="_blank" rel="noreferrer"><span>in</span>LinkedIn · {c.linkedin.handle}</a>
            <a href={CONTENT.identity.cvUrl} download className="cl-contact-cv"><span>⎙</span>Télécharger le CV</a>
          </div>
        </section>
      </main>

      <footer className="cl-foot">
        <span>© 2026 {CONTENT.identity.name} — {CONTENT.identity.school}</span>
        <button className="cl-btn" onClick={onBack}>
          ↩ Retour à la cuisine 3D
        </button>
      </footer>
    </div>
  );
}
