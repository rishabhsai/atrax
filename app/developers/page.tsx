import Link from "next/link";
import { products } from "../lib/content";

export const metadata = {
  title: "Developers",
  description:
    "A compact TypeScript cloud contract built for coding agents and small software.",
};

export default function DevelopersPage() {
  const primitives = [
    [products.hosting, "web()", "request · env · logs"],
    [products["agent-runtime"], "agent()", "run · tools · approval"],
    [products.workers, "worker()", "event · queue · schedule"],
    [products.database, "database()", "query · mutation · transaction"],
    [products.auth, "auth()", "user · team · role"],
    [products.storage, "storage()", "object · upload · signedUrl"],
    [products.secrets, "connection()", "grant · actor · audit"],
  ] as const;

  return (
    <main>
      <section className="dev-hero-v2">
        <div className="shell dev-hero-v2-grid">
          <div>
            <p className="section-kicker">Developers</p>
            <h1>One small cloud a coding agent can build against.</h1>
            <p>
              A compact TypeScript contract for deploying web, data, auth,
              files, workers, and operational agents as one app.
            </p>
            <div className="dev-command-v2">
              <span>$</span>
              <code>npx tarantula new renewal-board</code>
              <b>↵</b>
            </div>
          </div>
          <div className="dev-project-window">
            <div className="dev-project-top">
              <span>renewal-board/</span>
              <span>proposed alpha API</span>
            </div>
            <div className="dev-project-body">
              <div className="dev-tree">
                <span>app/</span>
                <span>↳ page.tsx</span>
                <span>↳ styles.css</span>
                <span>workers.ts</span>
                <span className="selected">tarantula.ts</span>
              </div>
              <pre><code>{`import {
  defineApp, web, database,
  auth, storage
} from "tarantula";

export default defineApp({
  web: web("./app"),
  database: database({ accounts }),
  auth: auth({ audience: "workspace" }),
  storage: storage(),
  workers: [syncHubspot],
  agents: [reviewRenewals],
  connections: [hubspot]
});`}</code></pre>
            </div>
            <div className="dev-project-foot">
              <span><i /> local cloud ready</span>
              <code>localhost:3000</code>
            </div>
          </div>
        </div>
      </section>

      <section className="two-agents-section">
        <div className="shell two-agents-grid">
          <p className="section-kicker">Two kinds of agents. One clear boundary.</p>
          <div>
            <article>
              <span>BUILD TIME</span>
              <h2>Coding agent</h2>
              <p>Reads the repo and Tarantula contract, writes the app, runs the CLI, and proposes the deployment.</p>
            </article>
            <article>
              <span>RUN TIME</span>
              <h2>Operational agent</h2>
              <p>Runs inside the deployed app from a user action, webhook, or schedule, with scoped tools, checkpoints, budgets, and approvals.</p>
              <pre><code>{`agent({
  on: schedule("0 8 * * 1"),
  tools: [accounts, hubspot],
  budget: "$2/run",
  approve: ["outreach.send"],
  run: reviewRenewals
})`}</code></pre>
            </article>
          </div>
        </div>
      </section>

      <section className="shell quickstart-v2">
        <div className="quickstart-heading">
          <p className="section-kicker">Three commands</p>
          <h2>A complete loop with almost nothing to remember.</h2>
        </div>
        <div className="quickstart-steps">
          {[
            ["01", "Create", "npx tarantula new my-app", "Start from a small full-stack app your coding agent can read in one pass."],
            ["02", "Develop", "npx tarantula dev", "Run the web app, database, auth, workers, files, and agents together locally."],
            ["03", "Deploy", "npx tarantula deploy", "Publish the exact app you tested and receive a shareable URL."],
          ].map(([index, title, command, copy]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <code>$ {command}</code>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dev-primitives-section">
        <div className="shell">
          <div className="section-heading">
            <p className="section-kicker">The cloud API</p>
            <h2>Literal primitives. One shared context.</h2>
            <p>
              Agents do not need to discover which vendor, SDK, credential, and
              dashboard own each part of the app.
            </p>
          </div>
          <div className="dev-primitive-table-v2">
            <div className="dev-primitive-head">
              <span>Primitive</span><span>In code</span><span>Runtime context</span>
            </div>
            {primitives.map(([product, primitive, context]) => (
              <Link href={`/products/${product.slug}`} key={product.slug}>
                <strong>{product.name}</strong>
                <code>{primitive}</code>
                <span>{context}</span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="dev-inspect-section">
        <div className="shell dev-inspect-grid">
          <div>
            <p className="section-kicker">Built for coding agents to inspect</p>
            <h2>Let coding agents inspect state instead of scraping dashboards.</h2>
            <p>
              The CLI exposes schemas, rows, files, permissions, worker logs,
              agent traces, usage, and deployment state in predictable formats.
              JSON output is versioned, resource IDs are stable, and failures
              return non-zero exit codes.
            </p>
          </div>
          <div className="inspect-terminal">
            <div><span>terminal</span><span>npx tarantula inspect --json</span></div>
            <pre><code>{`$ npx tarantula inspect --json

APP       renewal-board
URL       renewal-board.tarantula.app
ACCESS    workspace · 8 users

DATABASE  healthy · 42 rows
WORKERS   3 active · 0 failed
AGENTS    1 running · 14 complete
STORAGE   18 objects · 24.6 MB
SECRETS   2 grants · 0 raw keys

✓ production matches local contract`}</code></pre>
          </div>
        </div>
      </section>

      <section className="dev-guarantees">
        <div className="shell dev-guarantees-grid">
          <p className="section-kicker">The contract</p>
          <div>
            {[
              ["Local mirrors production", "The same bindings, schema, and permission contract exist before deploy."],
              ["App resources are code", "App-owned resources are versioned beside the code; company credentials stay in the vault by connection name."],
              ["Deployment plans are explicit", "One plan previews code, migration, worker, agent, and policy changes and reports what applied."],
              ["The surface stays small", "Tarantula adds integrated capability before it adds another concept."],
            ].map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Private alpha</p>
          <div>
            <h2>Give your coding agent a smaller cloud to understand.</h2>
            <div className="button-row">
              <Link className="button button-accent" href="/company">
                Request access <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-dark-quiet" href="/security">
                Read the security model
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
