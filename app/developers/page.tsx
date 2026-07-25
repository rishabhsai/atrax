import Link from "next/link";
import { DeployTerminal } from "../components/Visuals";

export const metadata = {
  title: "CLI",
  description:
    "The working Tarantula CLI contract for creating, running, deploying, inspecting, and debugging an app.",
};

const commands = [
  ["new", "tarantula new open-chat --template chat", "Write the app, migration, tests, and agent instructions."],
  ["dev", "tarantula dev", "Apply local migrations and run the Worker, assets, and D1 together."],
  ["deploy", "tarantula deploy --json", "Provision remote D1, migrate, deploy, wait for readiness, and return the URL."],
  ["inspect", "tarantula inspect --json", "Read the real Worker deployment and D1 state."],
  ["logs", "tarantula logs", "Stream request outcomes from the deployed Worker."],
] as const;

export default function DevelopersPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">The working CLI</p>
          <div>
            <h1>The whole v0 loop fits in five commands.</h1>
            <p>
              The CLI owns the app contract, Cloudflare account check, D1
              provisioning, migrations, deployment readiness, lockfile, and
              machine output.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell cli-demo-section">
        <div className="section-intro">
          <p className="eyebrow">Reference deployment</p>
          <h2>The output points to real resources.</h2>
        </div>
        <DeployTerminal />
      </section>

      <section className="cli-reference">
        <div className="shell">
          {commands.map(([name, command, copy], index) => (
            <article key={name}>
              <span>0{index + 1}</span>
              <h2>{name}</h2>
              <code>{command}</code>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section shell agent-contract">
        <div className="section-intro">
          <p className="eyebrow">Built for coding agents</p>
          <h2>State is readable without a browser.</h2>
        </div>
        <div className="agent-contract-grid">
          <div>
            <h3>Predictable files</h3>
            <pre><code>{`tarantula.json
tarantula.lock.json
src/worker.js
public/
migrations/
AGENTS.md`}</code></pre>
          </div>
          <div>
            <h3>Predictable output</h3>
            <pre><code>{`{
  "schemaVersion": 1,
  "status": "deployed",
  "name": "open-chat",
  "url": "https://...",
  "deploymentId": "...",
  "resources": { "tables": { ... } }
}`}</code></pre>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Exact commands and files</p>
            <h2>Continue in the docs.</h2>
          </div>
          <Link className="button button-orange" href="/docs/cli">
            Open CLI reference <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
