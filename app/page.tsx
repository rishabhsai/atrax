import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { AccountPreview, DeployTerminal, ProductMark } from "./components/Visuals";
import { productOrder, products } from "./lib/content";

export const metadata = {
  title: "Tarantula | A cloud for everyone",
  description:
    "Create, run, deploy, inspect, and debug small full-stack apps from one CLI.",
};

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">The agent-native cloud</p>
            <h1>A cloud for everyone.</h1>
            <p className="hero-summary">
              Tell your coding agent what to build. Tarantula deploys the app,
              keeps its data, connects company tools, and shows you exactly
              what is running.
            </p>
            <AgentCommand />
            <p className="hero-note">
              One read-only command gives your agent the docs, app contract,
              safety rules, and machine-readable deployment workflow.{" "}
              <Link href="/docs">Read the quickstart →</Link>
            </p>
          </div>
          <DeployTerminal />
        </div>
        <div className="hero-rail" aria-label="Current capabilities">
          <span>Apps</span>
          <span>Data</span>
          <span>Access</span>
          <span>Knowledge</span>
          <span>Automations</span>
        </div>
      </section>

      <section className="section shell proof-section">
        <div className="section-intro">
          <p className="eyebrow">The shortest path to useful</p>
          <h2>From an idea to running software.</h2>
          <p>
            Your agent works against one small contract. Tarantula handles the
            provider details and leaves every result inspectable.
          </p>
        </div>
        <div className="proof-flow">
          {[
            ["01", "Scaffold", "Write the complete app and agent instructions."],
            ["02", "Run", "Apply migrations and keep local D1 state."],
            ["03", "Deploy", "Provision remote D1 and publish the Worker."],
            ["04", "Inspect", "Read deployment and database state as JSON."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="account-story">
        <div className="shell account-story-copy">
          <p className="eyebrow">Your Tarantula account</p>
          <h2>Everything you shipped. In one quiet place.</h2>
          <p>
            See projects, environments, health, releases, resources, and recent
            activity without opening a provider console.
          </p>
        </div>
        <div className="shell account-preview-wrap">
          <AccountPreview />
        </div>
      </section>

      <section className="products-stage">
        <div className="shell">
          <div className="section-intro products-stage-intro">
            <p className="eyebrow">One cloud, clear parts</p>
            <h2>Everything an app needs. Nothing overlapping.</h2>
          </div>
          <div className="product-ledger">
            {productOrder.map((slug) => {
              const product = products[slug];
              return (
                <Link href={`/products/${slug}`} key={slug}>
                  <span className="product-number">{product.number}</span>
                  <ProductMark type={slug} />
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.cardTitle}</p>
                  </div>
                  <small className={`status status-${product.availability}`}>
                    {product.availability}
                  </small>
                  <b aria-hidden="true">↗</b>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section shell boundaries">
        <div className="section-intro">
          <p className="eyebrow">Designed to stay understandable</p>
          <h2>Six products. Six responsibilities.</h2>
        </div>
        <div className="boundary-lines">
          <article>
            <span>Launchpad</span>
            <h3>How software ships</h3>
            <p>Runtime, releases, URLs, rollback, inspection, and logs.</p>
          </article>
          <article>
            <span>Tables</span>
            <h3>What state it keeps</h3>
            <p>Structured data, migrations, queries, backup, and restore.</p>
          </article>
          <article>
            <span>Door</span>
            <h3>Who may enter</h3>
            <p>Identity, sessions, invitations, teams, sharing, and roles.</p>
          </article>
          <article>
            <span>Library</span>
            <h3>What the company knows</h3>
            <p>Files, policies, notes, search, provenance, and freshness.</p>
          </article>
          <article>
            <span>Switchboard</span>
            <h3>What an app may do</h3>
            <p>Vaulted credentials, typed tools, scoped grants, and an action ledger.</p>
          </article>
          <article>
            <span>Loops</span>
            <h3>What keeps running</h3>
            <p>Jobs, schedules, queues, agents, retries, approvals, and traces.</p>
          </article>
        </div>
      </section>

      <section className="agent-docs">
        <div className="shell agent-docs-grid">
          <div>
            <p className="eyebrow">A shared language</p>
            <h2>People and agents read the same cloud.</h2>
            <p>
              The same docs ship as readable pages, Markdown entrypoints,
              `docs.json`, `llms.txt`, and versioned CLI JSON.
            </p>
            <Link className="text-link" href="/docs">
              Open the docs <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="agent-files" aria-label="Agent documentation files">
            <a href="/docs.json"><span>docs.json</span><small>page manifest</small></a>
            <a href="/llms.txt"><span>llms.txt</span><small>agent index</small></a>
            <a href="/llms-full.txt"><span>llms-full.txt</span><small>complete reference</small></a>
            <Link href="/docs/app-contract"><span>tarantula.json</span><small>app contract</small></Link>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Shared context, instantly</p>
            <h2>Teach your agent Tarantula.</h2>
          </div>
          <div>
            <code>curl -fsSL https://tarantula-9l0.pages.dev/agent</code>
            <Link className="button button-orange" href="/agent">
              Read the agent file <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
