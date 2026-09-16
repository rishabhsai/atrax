import Link from "next/link";

export const metadata = {
  title: "Company",
  description: "A cloud for the software small businesses build for themselves.",
};

export default function CompanyPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Atrax</p>
          <div>
            <h1>Your business has its own way of working.</h1>
            <p>
              Your software should fit it. Atrax is a cloud for small businesses
              building their own internal tools with coding agents.
            </p>
            <div className="button-row">
              <Link className="button button-dark" href="/solutions">
                Explore the use cases <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section shell company-thesis">
        <div className="section-intro">
          <p className="eyebrow">Why Atrax</p>
          <h2>The prototype is only the beginning.</h2>
        </div>
        <div>
          <p>
            An agent can build the tracker you need. Then someone needs a link.
            A teammate needs access. The records need to survive the next
            update. Another app needs to check the same stock.
          </p>
          <p>
            Atrax handles that part. Your apps live in a company workspace, with
            data, access, and named actions that other apps and agents can use.
            Shared guidance lives in Library, ready for the next task.
          </p>
          <p>
            Keep your source in GitHub and bring the coding agent you prefer.
            Use Atrax to run what you build.
          </p>
        </div>
      </section>
      <section className="principles">
        <div className="shell">
          {[
            [
              "01",
              "Useful software first",
              "Start with a real task your business needs. Build locally, try it, and deploy it for the people doing the work.",
            ],
            [
              "02",
              "The company keeps the app",
              "Apps, URLs, and business records belong to the workspace. A teammate leaving should not take the company's tools with them.",
            ],
            [
              "03",
              "Agents are first-class users",
              "Agents can operate through the CLI and MCP, acting for a verified person with that person's current permissions.",
            ],
            [
              "04",
              "Knowledge belongs to the team",
              "Save policies, preferences, and decisions where authorized people and agents can find and correct them.",
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
            <p className="eyebrow">Build something useful</p>
            <h2>A cloud for the tools your team needs.</h2>
          </div>
          <div className="button-row">
            <a
              className="button button-orange"
              href="https://github.com/rishabhsai/atrax/tree/feat/workspace-launch"
            >
              View GitHub <span aria-hidden="true">↗</span>
            </a>
            <Link className="button button-outline-light" href="/docs/quickstart">
              Start building
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
