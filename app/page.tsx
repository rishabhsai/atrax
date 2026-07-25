import Image from "next/image";
import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { AccountPreview, ProductMark } from "./components/Visuals";
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
        </div>
        <div className="hero-rail" aria-label="Current capabilities">
          <span>Apps</span>
          <span>Data</span>
          <span>Access</span>
          <span>Knowledge</span>
          <span>Automations</span>
        </div>
      </section>

      <section className="agent-work">
        <div className="shell agent-work-intro">
          <p className="eyebrow">Software that keeps moving</p>
          <h2>Deploy an agent. Let it get the work done.</h2>
          <p>
            Ship an agent behind the same small contract as any other app.
            Tarantula keeps the release understandable—then gives the work a
            place to continue.
          </p>
        </div>
        <div className="shell agent-work-stories">
          <article className="agent-work-story">
            <div className="agent-work-art">
              <Image
                alt="An orange continuous loop carrying three work nodes around a black platform"
                height={800}
                src="/loops-agents.png"
                width={1600}
              />
            </div>
            <div className="agent-work-copy">
              <span>01 / Loops</span>
              <h3>Your agent can keep working after the tab closes.</h3>
              <p>
                Deploy the agent with Launchpad today. Loops adds the
                long-running layer for schedules, webhooks, queues, retries,
                approvals, and traces—so useful work can finish on its own.
              </p>
              <Link href="/products/loops">
                Explore Loops <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>

          <article className="agent-work-story agent-work-story-reverse">
            <div className="agent-work-art">
              <Image
                alt="Three black app planes joined through one orange connection layer"
                height={800}
                src="/switchboard-apps.png"
                width={1600}
              />
            </div>
            <div className="agent-work-copy">
              <span>02 / Switchboard</span>
              <h3>Then let your apps work together automatically.</h3>
              <p>
                One app exposes a typed action; another receives a narrow
                grant. Switchboard connects them without copying credentials,
                while every automatic action stays scoped and inspectable.
              </p>
              <Link href="/products/switchboard">
                Explore Switchboard <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
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
