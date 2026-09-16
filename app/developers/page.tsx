import Link from "next/link";
import { AgentCommand } from "../components/AgentCommand";

export const metadata = {
  title: "CLI and MCP for your company workspace",
  description:
    "Deploy an app, share it with a verified guest, call app actions, and contribute company knowledge from the Atrax CLI or your existing agent.",
};

const commands = [
  [
    "Build and deploy",
    "atrax new team-chat --template chat\ncd team-chat\natrax dev\n# Stop the local server when ready to deploy.\natrax deploy --json",
    "Create an app, run it locally, then publish it to your workspace. Sign-in begins when you first deploy.",
  ],
  [
    "Find and call app actions",
    `atrax call actions.list \\
  --input '{"appId":"<app-id>"}' --json`,
    "Discover an app’s named actions and input schemas. Use actions.call under your current permissions.",
  ],
  [
    "Contribute company knowledge",
    'atrax library upload ./brand.md \\\n  --workspace <workspace-id> --key brand-v1\natrax library search "brand" --workspace <workspace-id> --json',
    "Upload a document, search Library, and retrieve items or files. Agents can also create and revise entries through the operation API.",
  ],
  [
    "Connect through MCP",
    'atrax login --agent "Operations agent"\natrax workspace use <workspace-id>\natrax mcp --workspace <workspace-id>',
    "Connect the agent you already use through the MCP stdio server. Give each connection a name and revoke its session independently.",
  ],
] as const;

export default function DevelopersPage() {
  return (
    <main className="developers-page">
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <div>
            <h1>Build locally. Run it for your company.</h1>
            <p>
              Use the CLI to create, develop, deploy, and manage apps. Connect
              the agent you already use through MCP to work with the same
              workspace permissions.
            </p>
            <div className="hero-actions">
              <Link className="button button-orange" href="/agents.md">
                Give this to your agent <span aria-hidden="true">→</span>
              </Link>
              <Link className="text-link" href="/docs/mcp">
                Connect MCP <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell cli-orientation">
        <div className="section-split">
          <div className="split-copy">
            <h2>Readable commands. Structured results.</h2>
            <p>
              Use <code>--json</code> for machine-readable command results.
              Named operations take schema-checked input. Writes use a stable
              request key so an agent can identify the same intent across
              retries.
            </p>
            <p>
              Install the released CLI below, or give your agent the{" "}
              <Link className="text-link" href="/agents.md">
                agent guide
              </Link>
              .
            </p>
          </div>
          <nav className="agent-files" aria-label="Agent references">
            <a href="/agents.md">
              <span>agents.md</span>
              <small>Canonical setup and workflow guide</small>
            </a>
            <a href="/operations.json">
              <span>operations.json</span>
              <small>Discover operation inputs and outputs</small>
            </a>
            <Link href="/docs/cli">
              <span>CLI reference</span>
              <small>Commands, options, and JSON envelopes</small>
            </Link>
            <Link href="/docs/mcp">
              <span>MCP setup</span>
              <small>Connect your own agent</small>
            </Link>
          </nav>
        </div>
        <AgentCommand />
      </section>

      <section className="sharing-section" id="private-sharing">
        <div className="shell">
          <div className="section-intro">
            <h2>Share a private app with one person.</h2>
            <p>
              An owner or admin can invite a verified email to one app. The
              guest proves control of that exact email before opening it.
            </p>
          </div>
          <div className="share-recipe-grid">
            <ol className="recipe-steps">
              <li>
                <strong>Review access</strong>
                <p>
                  Check the app audience, existing guest access, and public-web
                  state before sharing.
                </p>
              </li>
              <li>
                <strong>Invite the guest</strong>
                <p>
                  Share the app with their email and select any actions they may
                  use.
                </p>
              </li>
              <li>
                <strong>Send the stable URL</strong>
                <p>
                  After accepting the invitation, the guest can open the same
                  app URL. Revoke the grant when the review ends.
                </p>
              </li>
            </ol>
            <div className="recipe-code">
              <pre>
                <code>{String.raw`atrax share reviewer@example.com \
  --app <app-id> \
  --key invite-reviewer-v1 --json`}</code>
              </pre>
              <p>
                Guest sharing does not add the recipient to the workspace or
                change access for current company members.
              </p>
            </div>
          </div>
          <div className="sharing-caveat">
            <strong>Private means private</strong>
            <p>
              Public web must be off for a private review. A guest grant covers
              only the selected app and actions.
            </p>
            <Link className="text-link" href="/docs/door">
              Read the access rules →
            </Link>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-intro">
          <h2>Work from a new app to a connected workspace.</h2>
        </div>
        <div className="command-examples">
          {commands.map(([title, code, copy]) => (
            <article key={title}>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <pre>
                <code>{code}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="section shell rule-top">
        <div className="section-split">
          <div className="split-copy">
            <h2>Use the same operations from the CLI and MCP.</h2>
            <p>
              Both interfaces use the platform operation registry and check the
              current person’s permissions. MCP exposes authenticated workspace
              operations; browser and device sign-in handshakes stay in the
              login flow.
            </p>
          </div>
          <div className="cli-details">
            <h3>More operations</h3>
            <p>
              <code>atrax call &lt;operation&gt;</code> covers team invitations,
              app and action audiences, guest access, sessions, backups, and
              recovery. Use <a href="/operations.json">the operation schemas</a>{" "}
              for exact input and output shapes.
            </p>
            <h3>Current limits</h3>
            <p>
              For automated writes, choose a stable <code>--key</code> and reuse
              it with identical input when retrying. Inspect contracts with{" "}
              <code>atrax operations inspect</code> and workflows with{" "}
              <code>atrax recipes list</code>. Hosted agents and scheduled
              automation are planned for later.
            </p>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <h2>Give your agent the guide.</h2>
          </div>
          <Link className="button button-orange" href="/agents.md">
            Open agents.md <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
