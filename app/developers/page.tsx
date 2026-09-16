import Link from "next/link";
import { DeployTerminal } from "../components/Visuals";

export const metadata = {
  title: "CLI and MCP",
  description:
    "Create company apps, operate them through the CLI, and connect an existing agent through MCP.",
};

const commands = [
  [
    "new",
    "node bin/atrax.mjs new team-chat --template chat",
    "Create a source-owned app from a working template.",
  ],
  [
    "dev",
    "node bin/atrax.mjs dev",
    "Run the app and its declared local data together.",
  ],
  [
    "deploy",
    "node bin/atrax.mjs deploy --json",
    "Verify identity when needed, publish a workspace-owned app, and return structured output.",
  ],
  [
    "library",
    'atrax library search "brand" --workspace <id> --json',
    "Search company knowledge that the current identity may read.",
  ],
  [
    "actions",
    'atrax call actions.list --input \'{"appId":"<id>"}\' --json',
    "Discover the named actions an app currently exposes.",
  ],
  [
    "mcp",
    "atrax mcp --workspace <id>",
    "Run the official MCP stdio server for a named agent session.",
  ],
] as const;

export default function DevelopersPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">CLI and MCP</p>
          <div>
            <h1>
              Use one operation contract from the terminal or an existing agent.
            </h1>
            <p>
              The CLI creates and deploys company apps, contributes Library
              content, and calls named actions. MCP exposes the same platform
              operations to an agent you already run.
            </p>
          </div>
        </div>
      </section>
      <section className="section shell cli-demo-section">
        <div className="section-intro">
          <p className="eyebrow">Structured output</p>
          <h2>Use the CLI and MCP in the same workspace.</h2>
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
          <p className="eyebrow">Shared interface</p>
          <h2>Use the same operations from the CLI and MCP.</h2>
        </div>
        <div className="agent-contract-grid">
          <div>
            <h3>App files</h3>
            <pre>
              <code>{`atrax.json\natrax.lock.json\nsrc/actions.js\npublic/\nmigrations/\nAGENTS.md`}</code>
            </pre>
          </div>
          <div>
            <h3>Write operation</h3>
            <pre>
              <code>{`{\n  "input": { "appId": "<app-id>" },\n  "key": "<stable-business-key>"\n}`}</code>
            </pre>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Exact commands</p>
            <h2>Continue in the CLI and MCP docs.</h2>
          </div>
          <Link className="button button-orange" href="/docs/cli">
            Open CLI reference <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
