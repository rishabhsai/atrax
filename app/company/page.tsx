import Link from "next/link";

export const metadata = {
  title: "Company",
  description:
    "Tarantula is building a cloud for small software made by coding agents.",
};

export default function CompanyPage() {
  return (
    <main>
      <section className="company-hero-v2">
        <div className="shell company-hero-v2-grid">
          <p className="section-kicker">Tarantula Systems</p>
          <div>
            <h1>We are building a cloud for small software.</h1>
            <p>
              Tarantula is a developer cloud for personal apps, internal tools,
              and operational agents built by coding agents, usually for one
              person or one team.
            </p>
          </div>
        </div>
      </section>

      <section className="company-origin">
        <div className="shell company-origin-grid">
          <p className="section-kicker">Why now</p>
          <div>
            <p className="company-origin-statement">
              Coding agents made bespoke software cheap. The remaining cost is
              turning generated code into something people can safely keep and
              share.
            </p>
            <div className="company-origin-copy">
              <p>
                Personal apps, team tools, and narrow operational systems do
                not need the service catalogs designed for software serving
                millions of users.
              </p>
              <p>
                They need a complete default: hosting, data, identity, files,
                workers, agent runs, company connections, and one permission
                model.
              </p>
              <p>
                YC named the category. Our bet is that small software becomes
                far more valuable when it can keep working safely through
                durable operational agents and company-scoped tools.
              </p>
              <a
                className="inline-link"
                href="https://www.ycombinator.com/rfs#a-cloud-for-small-software"
              >
                Read the YC request for startups <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="company-thesis-strip">
        <div className="shell">
          <p>Big clouds optimize for software serving millions.</p>
          <p>Small software needs a complete default and far fewer concepts.</p>
        </div>
      </section>

      <section className="company-beliefs">
        <div className="shell">
          <div className="section-heading">
            <p className="section-kicker">What we believe</p>
            <h2>Small software changes what a cloud should optimize for.</h2>
          </div>
          <div className="company-belief-grid">
            {[
              ["01", "Optimize for coherence", "An agent should understand the whole app and its cloud without crossing seven vendor boundaries."],
              ["02", "Make sharing fundamental", "A private app should be as easy to share with a teammate as a document."],
              ["03", "Treat code as untrusted", "Agent-built apps start isolated and receive only explicit people, data, network, and tool access."],
              ["04", "Let software keep working", "Operational agents belong inside the app when the job requires judgment, tools, or human approval."],
            ].map(([index, title, copy]) => (
              <article key={index}>
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="company-building-section">
        <div className="shell company-building-grid">
          <div>
            <p className="section-kicker">What we are building</p>
            <h2>A complete cloud with fewer concepts.</h2>
          </div>
          <div className="company-building-list">
            <Link href="/products"><span>01</span><strong>The small cloud</strong><p>Hosting, Workers, Database, Auth, Storage, and Secrets &amp; Connections.</p><b>↗</b></Link>
            <Link href="/products/agent-runtime"><span>02</span><strong>Operational agents</strong><p>Durable runs, tools, approvals, traces, schedules, and budgets inside the app.</p><b>↗</b></Link>
            <Link href="/security"><span>03</span><strong>The trust model</strong><p>Isolated apps, company identity, scoped tool grants, and complete actor chains.</p><b>↗</b></Link>
          </div>
        </div>
      </section>

      <section className="company-alpha-v2" id="alpha">
        <div className="shell company-alpha-v2-grid">
          <div>
            <p className="section-kicker">Private alpha</p>
            <h2>Bring us one useful app your team should already have.</h2>
          </div>
          <div>
            <p>
              We are seeking a small set of technical design partners for
              internal tools and operational-agent systems.
            </p>
            <a className="button button-accent" href="mailto:hello@tarantula.build">
              Email hello@tarantula.build <span aria-hidden="true">→</span>
            </a>
            <small>
              Tell us the app, who uses it, what recurring work it should do,
              and which company systems it must access. Security reports:
              security@tarantula.build.
            </small>
          </div>
        </div>
      </section>
    </main>
  );
}
