import Link from "next/link";

export const metadata = {
  title: "Company",
  description:
    "Atrax is building an agent-native cloud for small software.",
};

export default function CompanyPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Atrax</p>
          <div>
            <h1>Small software needs a smaller cloud.</h1>
            <p>
              Coding agents can write an app quickly. Atrax is reducing the
              work between a folder and software people can keep using.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell company-thesis">
        <div className="section-intro">
          <p className="eyebrow">The thesis</p>
          <h2>Optimize for coherence, not service count.</h2>
        </div>
        <div>
          <p>
            A coding agent should create the app, run its data locally, deploy
            it, inspect production, and fix a failure without scraping five
            dashboards.
          </p>
          <p>
            The current v0 proves that loop for public Workers apps with D1.
            The roadmap adds identity, knowledge, connected tools, and durable
            execution without adding overlapping products.
          </p>
        </div>
      </section>

      <section className="principles">
        <div className="shell">
          {[
            ["01", "Working proof before positioning", "A command appears on the site only after it runs."],
            ["02", "One product per responsibility", "Library reads, Switchboard acts, and Loops runs."],
            ["03", "One workflow for people and agents", "Every control-plane action needs a CLI and machine output."],
            ["04", "Small companies first", "The default path should end at a useful link this week."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Private repository, public proof app</p>
            <h2>Follow the implementation.</h2>
          </div>
          <div className="button-row">
            <a className="button button-orange" href="https://github.com/rishabhsai/tarantula">
              View GitHub <span aria-hidden="true">↗</span>
            </a>
            <Link className="button button-outline-light" href="/docs">
              Read docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
