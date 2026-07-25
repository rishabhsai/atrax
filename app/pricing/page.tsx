import Link from "next/link";

export const metadata = {
  title: "Pricing",
  description:
    "Private-alpha access and pricing principles for the Tarantula small cloud.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="pricing-hero-v2">
        <div className="shell pricing-hero-v2-grid">
          <p className="section-kicker">Pricing</p>
          <div>
            <h1>Private alpha now. Simple app-based pricing later.</h1>
            <p>
              There is no public price yet. We are testing a model based on
              active apps and measured usage, with internal viewers included.
            </p>
          </div>
        </div>
      </section>

      <section className="shell alpha-pricing-card">
        <div className="alpha-pricing-title">
          <p className="section-kicker">Private alpha</p>
          <h2>Custom pilot agreement</h2>
          <span>Agreed before onboarding</span>
        </div>
        <div className="alpha-pricing-includes">
          <p>One relationship, the complete small cloud:</p>
          <ul>
            <li>Hosting, Workers, Database, Auth, Storage</li>
            <li>Agent Runtime and Secrets &amp; Connections</li>
            <li>Internal viewers included, subject to agreed pilot limits</li>
            <li>Direct product and architecture support</li>
            <li>Influence over the runtime and permission model</li>
          </ul>
          <Link className="button button-primary" href="/company">
            Apply for access <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="alpha-pricing-note">
          <span>Usage</span>
          <strong>Measured and capped by app</strong>
          <p>Compute, model calls, storage, and outbound traffic are visible separately. The pilot states which usage is included, billed, or capped.</p>
        </div>
      </section>

      <section className="pricing-principles-v2">
        <div className="shell">
          <div className="section-heading">
            <p className="section-kicker">Pricing principles</p>
            <h2>Let useful software spread inside the team.</h2>
          </div>
          <div className="pricing-principle-grid">
            {[
              ["No viewer tax", "Inviting a teammate should not turn a useful internal app into a seat-cost debate."],
              ["Pay for operation", "Active apps, workers, agent runs, storage, and model usage are the things that create cost."],
              ["One platform line", "The built-in cloud products belong together instead of becoming seven vendor bills."],
              ["Visible by app", "Teams can understand which small app uses what before deciding whether it is worth keeping."],
            ].map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="shell pricing-faq-v2">
        <p className="section-kicker">Questions</p>
        <div>
          {[
            ["Is the private alpha free?", "Not necessarily. Each design partner uses a written pilot agreement that states any fees, included usage, caps, and support before onboarding."],
            ["Can we set spending limits?", "That is the target. Usage is visible by app and operational-agent run, with pilot caps agreed before deployment."],
            ["Do teammates need paid seats?", "Ordinary internal viewers are included during alpha, subject to the limits in the pilot agreement."],
            ["What happens after alpha?", "The planned model is based on active apps and measured usage. Pilot partners will receive notice and export options before any pricing transition."],
            ["Can we export and delete our data?", "The alpha target includes database and file export plus verified workspace deletion on request."],
            ["Can I self-serve today?", "Not yet. We are onboarding a small set of design partners while the runtime contract is still changing."],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>{question}<span aria-hidden="true">+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Private alpha</p>
          <div>
            <h2>Start with one app worth keeping alive.</h2>
            <Link className="button button-accent" href="/company">
              Become a design partner <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
