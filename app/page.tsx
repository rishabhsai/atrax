import Link from "next/link";
import { DeployTerminal, ProductMark } from "./components/Visuals";
import { productOrder, products } from "./lib/content";

export const metadata = {
  title: "Tarantula | An agent-native cloud for small software",
  description:
    "Create, run, deploy, inspect, and debug small full-stack apps from one CLI.",
};

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Agent-native cloud for small software</p>
            <h1>A small cloud your coding agent can operate.</h1>
            <p className="hero-summary">
              Create, run, deploy, inspect, and debug from one CLI. Launchpad
              and Tables work today. Door, Library, Switchboard, and Loops are
              the roadmap.
            </p>
            <div className="button-row">
              <Link className="button button-dark" href="/docs">
                Read the quickstart <span aria-hidden="true">→</span>
              </Link>
              <a
                className="button button-outline-dark"
                href="https://tarantula-chat-demo.rishabhsai-mdbar.workers.dev"
              >
                Use the live chat <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="hero-note">
              Alpha install is local. Deployer uses your Cloudflare account.
              Visitors to the chat do not log in.
            </p>
          </div>
          <DeployTerminal />
        </div>
        <div className="hero-rail" aria-label="Current capabilities">
          <span>Worker + static assets</span>
          <span>D1 + ordered migrations</span>
          <span>Stable lockfile</span>
          <span>JSON deploy output</span>
          <span>Live inspect and logs</span>
        </div>
      </section>

      <section className="section shell proof-section">
        <div className="section-intro">
          <p className="eyebrow">Available now</p>
          <h2>From an empty folder to a working link.</h2>
          <p>
            The reference chat is public, persistent, and deployed by the same
            CLI in the docs.
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

      <section className="products-stage">
        <div className="shell">
          <div className="section-intro products-stage-intro">
            <p className="eyebrow">Six products, six jobs</p>
            <h2>The names stop where the responsibilities stop.</h2>
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
          <p className="eyebrow">The important boundaries</p>
          <h2>Knowledge, actions, and execution stay separate.</h2>
        </div>
        <div className="boundary-lines">
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
            <p>Requests, jobs, schedules, queues, agents, retries, approvals, and traces.</p>
          </article>
        </div>
      </section>

      <section className="agent-docs">
        <div className="shell agent-docs-grid">
          <div>
            <p className="eyebrow">Docs for people and agents</p>
            <h2>No dashboard scraping. No guessed state.</h2>
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
            <p className="eyebrow">Try the working slice</p>
            <h2>Deploy the chat. Keep the URL.</h2>
          </div>
          <div>
            <code>tarantula new open-chat --template chat</code>
            <Link className="button button-orange" href="/docs/chat-example">
              Follow the chat guide <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
