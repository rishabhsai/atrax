import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { ChipGrid } from "./components/ChipGrid";
import { CompareStrip } from "./components/CompareStrip";
import { Reveal } from "./components/Reveal";
import {
  AccountPreview,
  LoopTrace,
  OrgFabric,
  ProductMark,
  ShareSheet,
} from "./components/Visuals";
import { productOrder, products } from "./lib/content";

export const metadata = {
  title: "Tarantula | A cloud for everyone",
  description:
    "Create, run, deploy, inspect, and debug small full-stack apps from one CLI.",
};

const contractRows = [
  {
    label: "In the contract today",
    state: "available" as const,
    chips: [
      "worker runtime",
      "static assets",
      "D1 database",
      "ordered migrations",
      "local dev",
      "stable URL",
      "versioned JSON",
      "logs",
      "lockfile",
      "plan",
      "drift",
    ],
  },
  {
    label: "Landing next",
    state: "planned" as const,
    chips: ["stacks", "releases", "rollback"],
  },
  {
    label: "Planned products",
    state: "planned" as const,
    chips: ["Door", "Library", "Switchboard", "Loops"],
  },
];

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
              safety rules, and machine-readable deployment workflow. No
              Cloudflare account? <code>tarantula deploy --instant</code> puts
              the app on a public URL and prints a claim token — claim it, or it
              disappears in 30 days.{" "}
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

      <section className="thesis">
        <div className="shell thesis-copy">
          <p className="eyebrow">Why Tarantula</p>
          <h2>
            Clouds deploy apps. Tarantula runs the software your company works
            in.
          </h2>
          <p className="thesis-summary">
            Every app you ship lands in one workspace — where your team can open
            it, your other apps can call it, and your agents can keep it
            running. The first app is a tool. The tenth is an operating system
            for your company.
          </p>
          <p className="thesis-note">
            Launchpad and Tables are available today. Door, Library,
            Switchboard, and Loops are planned, and every section below says
            where it stands.
          </p>
          <nav className="thesis-jump" aria-label="Jump to a section">
            <a href="#fabric">Apps that work together</a>
            <a href="#included">Everything included</a>
            <a href="#sharing">Share like a doc</a>
            <a href="#agents">Agents as apps</a>
          </nav>
        </div>
      </section>

      <section className="compare-section">
        <div className="shell section-split section-split-center">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>Operating surface</b>
            </p>
            <h2>Why an agent can operate it.</h2>
            <p>
              A conventional cloud spreads one app across a console, a policy
              file, a set of provisioned pieces, and a secret store. An agent
              has to hold all four and guess when they disagree.
            </p>
            <p>
              Tarantula keeps the whole app in one declared contract. The deploy
              command reconciles it and answers in versioned JSON, so the state
              is readable without a browser.
            </p>
            <Link className="text-link" href="/docs/app-contract">
              Read the app contract <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <CompareStrip />
          </Reveal>
        </div>
      </section>

      <section className="fabric" id="fabric">
        <Reveal className="shell fabric-intro">
          <p className="microlabel">
            02 · <b>One workspace</b>
          </p>
          <h2>Every app can use every other app. On your terms.</h2>
          <p>
            An app publishes named actions instead of a database or an API key.
            Another app receives one action, on one resource, for as long as you
            allow — and every call lands in a ledger you can read. Nothing is
            copied, nothing is shared by accident.
          </p>
          <p className="section-status">
            <span className="status status-planned">planned</span>
            <span>
              Switchboard, which owns grants, typed tools, and the action
              ledger, is not available yet. Launchpad and Tables run the apps
              today.
            </span>
          </p>
          <Link className="text-link" href="/products/switchboard">
            Read the Switchboard roadmap <span aria-hidden="true">→</span>
          </Link>
        </Reveal>
        <Reveal className="shell" delay={120}>
          <OrgFabric />
        </Reveal>
      </section>

      <section className="products-stage" id="included">
        <div className="shell">
          <Reveal className="section-intro products-stage-intro">
            <p className="microlabel">
              03 · <b>Everything included</b>
            </p>
            <h2>Six products. One contract. Nothing to assemble.</h2>
            <p>
              One `tarantula.json` declares the whole app: runtime, data,
              access, files, connected tools, and background work. You or your
              agent write the contract, and Tarantula reconciles it. Two
              products run today, four are planned, and each card says which.
            </p>
          </Reveal>
          <Reveal className="product-ledger" delay={100}>
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
          </Reveal>
        </div>
      </section>

      <section className="contract-section">
        <div className="shell section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              04 · <b>Status</b>
            </p>
            <h2>What ships today, and what lands next.</h2>
            <p>
              A filled square is in the working v0 contract and you can use it
              from the CLI now. A hollow square is planned work with a written
              boundary and no shipped surface.
            </p>
            <Link className="text-link" href="/docs/status">
              Read the full status page <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>tarantula.json</span>
              <span>v0 contract</span>
            </div>
            <ChipGrid
              note="Planned rows have no CLI surface yet. Nothing on this list is enabled by a flag you cannot see."
              rows={contractRows}
            />
          </Reveal>
        </div>
      </section>

      <section className="share-story" id="sharing">
        <div className="shell share-grid">
          <Reveal className="share-copy">
            <p className="microlabel">
              05 · <b>Sharing</b>
            </p>
            <h2>Share an app the way you share a doc.</h2>
            <p>
              Invite a teammate by email, choose what they can do, and send one
              URL. No login screen to build, no sessions to store, no identity
              provider to wire in. Access belongs to the platform instead of the
              app code.
            </p>
            <p className="section-status">
              <span className="status status-planned">planned</span>
              <span>
                Door owns sign-in, teams, roles, and one share control, and is
                not available yet. A v0 app ships public today, so anyone with
                its URL can open it.
              </span>
            </p>
            <Link className="text-link" href="/products/door">
              Read the Door roadmap <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <ShareSheet />
          </Reveal>
        </div>
      </section>

      <section className="loop-story" id="agents">
        <div className="shell loop-grid">
          <Reveal className="loop-copy">
            <p className="microlabel">
              06 · <b>Agents as apps</b>
            </p>
            <h2>Deploy an agent. Let it keep working.</h2>
            <p>
              An agent ships behind the same contract as any other app. Loops
              adds what a single request cannot hold: schedules, webhooks,
              queues, retries, a pause for approval before a sensitive action,
              and a trace of every step. The work continues after the tab
              closes.
            </p>
            <p className="section-status">
              <span className="status status-planned">planned</span>
              <span>
                Launchpad deploys the agent app today. The durable execution
                layer shown here belongs to Loops, which is not available yet.
              </span>
            </p>
            <Link className="text-link" href="/products/loops">
              Explore Loops <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <LoopTrace />
          </Reveal>
        </div>
      </section>

      <section className="account-story">
        <Reveal className="shell account-story-copy">
          <p className="eyebrow">Your Tarantula account</p>
          <h2>Everything you shipped. In one quiet place.</h2>
          <p>
            The workspace where all of it shows up: projects, environments,
            health, releases, resources, and recent activity, without opening a
            provider console.
          </p>
        </Reveal>
        <Reveal className="shell account-preview-wrap" delay={120}>
          <AccountPreview />
        </Reveal>
      </section>

      <section className="agent-docs">
        <div className="shell agent-docs-grid">
          <Reveal>
            <p className="eyebrow">A shared language</p>
            <h2>People and agents read the same cloud.</h2>
            <p>
              The same docs ship as readable pages, Markdown entrypoints,
              `docs.json`, `llms.txt`, and versioned CLI JSON.
            </p>
            <Link className="text-link" href="/docs">
              Open the docs <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="agent-files" aria-label="Agent documentation files">
              <a href="/docs.json"><span>docs.json</span><small>page manifest</small></a>
              <a href="/llms.txt"><span>llms.txt</span><small>agent index</small></a>
              <a href="/llms-full.txt"><span>llms-full.txt</span><small>complete reference</small></a>
              <Link href="/docs/app-contract"><span>tarantula.json</span><small>app contract</small></Link>
            </div>
          </Reveal>
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
