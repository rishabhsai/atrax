import Link from "next/link";

export const metadata = {
  title: "Company",
  description: "Atrax builds company-owned software with shared context.",
};

export default function CompanyPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Atrax</p>
          <div>
            <h1>Company software should carry its own context.</h1>
            <p>
              Apps are more useful when their ownership, access, business
              actions, and guidance stay legible to the people and agents doing
              the work.
            </p>
          </div>
        </div>
      </section>
      <section className="section shell company-thesis">
        <div className="section-intro">
          <p className="eyebrow">The thesis</p>
          <h2>Build software that keeps company context close.</h2>
        </div>
        <div>
          <p>
            A coding agent can create an interface quickly. The durable work is
            giving that interface a company owner, current permissions, a
            reliable way to ask another app for work, and shared guidance that
            can be corrected later.
          </p>
          <p>Atrax starts with the company-app workflow people use every day.</p>
        </div>
      </section>
      <section className="principles">
        <div className="shell">
          {[
            [
              "01",
              "Workflows people can use",
              "Build, share, and operate company apps from the workspace, CLI, or MCP.",
            ],
            [
              "02",
              "Company ownership",
              "Apps and their business data belong to a workspace instead of to an individual session.",
            ],
            [
              "03",
              "Current permissions",
              "Access is checked when a person, agent, or another app performs work.",
            ],
            [
              "04",
              "One interface for people and agents",
              "The operation registry feeds the HTTP, CLI, and MCP surfaces.",
            ],
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
            <p className="eyebrow">Learn more</p>
            <h2>Start with the workspace workflow.</h2>
          </div>
          <div className="button-row">
            <a
              className="button button-orange"
              href="https://github.com/rishabhsai/atrax"
            >
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
