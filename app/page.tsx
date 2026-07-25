import Link from "next/link";
import { AgentRunPanel, SharePanel, SmallCloudMap } from "./components/Visuals";
import { products, solutions } from "./lib/content";

export const metadata = {
  title: "Tarantula — A cloud for small software",
  description:
    "Deploy and share software built by agents with hosting, workers, databases, auth, storage, secrets, and durable agent infrastructure included.",
};

export default function Home() {
  const productGroups = [
    {
      name: "Deploy",
      description: "Put the app online and run code when something happens.",
      products: [products.hosting, products.workers],
    },
    {
      name: "Data",
      description: "Give every app relational data and private file storage.",
      products: [products.database, products.storage],
    },
    {
      name: "Identity",
      description: "Share safely and connect company systems without leaking keys.",
      products: [products.auth, products.secrets],
    },
    {
      name: "Operate",
      description: "Run durable agents with tools, retries, approvals, and traces.",
      products: [products["agent-runtime"]],
    },
  ];

  return (
    <main>
      <section className="home-hero">
        <div className="shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="hero-kicker">
              <span>Private alpha</span>
              A cloud for small software
            </p>
            <h1>Built for five users, not five million.</h1>
            <p className="hero-summary">
              Deploy agent-built apps with hosting, workers, databases, auth,
              files, secrets, and durable agents included. Private by default.
              Share with a link.
            </p>
            <div className="button-row">
              <Link className="button button-primary" href="/company">
                Join private alpha <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/developers">
                Developer overview
              </Link>
            </div>
          </div>
          <SmallCloudMap />
        </div>
        <div className="shell hero-proof">
          <span>Built for coding agents</span>
          <span>One command to deploy</span>
          <span>Private by default</span>
          <span>Share with a link</span>
        </div>
      </section>

      <section className="small-software-strip">
        <div className="shell">
          <p>Small software</p>
          <div>
            <span>Renewal tracker</span>
            <span>Research monitor</span>
            <span>Sprint planner</span>
            <span>Home inventory</span>
            <span>Release operator</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="cloud">
        <div className="section-heading">
          <p className="section-kicker">The whole small cloud</p>
          <h2>Everything the app needs. Nothing for an agent to glue together.</h2>
          <p>
            One project, one permission model, one deploy. Use only the pieces
            the app needs.
          </p>
        </div>
        <div className="product-domain-grid">
          {productGroups.map((group, index) => (
            <article key={group.name}>
              <span>0{index + 1}</span>
              <div>
                <h3>{group.name}</h3>
                <p>{group.description}</p>
              </div>
              <div className="domain-product-links">
                {group.products.map((product) => (
                  <Link href={`/products/${product.slug}`} key={product.slug}>
                    {product.name} <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="agent-section">
        <div className="shell agent-section-grid">
          <div className="agent-section-copy">
            <p className="section-kicker">Agent infrastructure included</p>
            <h2>Run agents for minutes, hours, or every Monday.</h2>
            <p>
              They keep state, retry safely, pause for approval, and expose
              every tool call and cost.
            </p>
            <ul className="check-list">
              <li>Resume after failures without repeating finished work</li>
              <li>Use scoped company connections and tools from other apps</li>
              <li>Pause for a person before sensitive actions</li>
            </ul>
            <Link className="inline-link" href="/products/agent-runtime">
              Explore Agent Runtime <span aria-hidden="true">→</span>
            </Link>
          </div>
          <AgentRunPanel />
        </div>
      </section>

      <section className="section shell share-section">
        <div className="share-copy">
          <p className="section-kicker">Sharing is a primitive</p>
          <h2>Small software should share like a Google Doc.</h2>
          <p>
            Every app starts private. Invite a person or team, choose what they
            can do, and send the link. Auth and permissions follow the app.
          </p>
          <Link className="inline-link" href="/products/auth">
            Explore Auth <span aria-hidden="true">→</span>
          </Link>
        </div>
        <SharePanel />
      </section>

      <section className="section shell solution-preview">
        <div className="section-heading">
          <p className="section-kicker">What people build</p>
          <h2>The missing software between a problem and a SaaS product.</h2>
        </div>
        <div className="solution-preview-grid">
          {Object.values(solutions).slice(0, 3).map((solution, index) => (
            <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
              <span>0{index + 1}</span>
              <div>
                <h3>{solution.name}</h3>
                <p>{solution.short}</p>
              </div>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-final">
        <div className="shell home-final-grid">
          <p className="section-kicker">Private alpha</p>
          <div>
            <h2>Build the small software your world is missing.</h2>
            <p>Bring an agent and a problem. Tarantula handles the cloud.</p>
            <div className="button-row">
              <Link className="button button-accent" href="/company">
                Join the alpha <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-dark-quiet" href="/products">
                See every product
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
