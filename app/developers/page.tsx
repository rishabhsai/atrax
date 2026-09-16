import Link from "next/link";

export const metadata = {
  title: "CLI and MCP for your company workspace",
  description:
    "Deploy an app, invite a verified guest, call app actions, and contribute company knowledge from the Atrax CLI or your existing agent.",
};

const commands = [
  ["Build and deploy", "atrax new team-chat --template chat\ncd team-chat\natrax dev\n# When ready, stop dev and deploy:\natrax deploy --json", "Create an app, run it locally, then publish it to your workspace. Sign-in begins when you first deploy."],
  ["Find and call app actions", `atrax call actions.list \\\n  --input '{"appId":"<app-id>"}' --json`, "Discover an app’s named actions and input schemas. Use actions.call to invoke an action under your current permissions."],
  ["Contribute company knowledge", "atrax library upload ./brand.md \\\n  --workspace <workspace-id> --key brand-v1\natrax library search \"brand\" --workspace <workspace-id> --json", "Upload a document, search the Library, and retrieve items or files. Agents can also create and revise entries through the operation API."],
  ["Connect through MCP", 'atrax login --agent "Operations agent"\natrax workspace use <workspace-id>\natrax mcp --workspace <workspace-id>', "Connect your existing agent through the MCP stdio server. Give each connection a name and revoke its session independently."],
] as const;

export default function DevelopersPage() {
  return (
    <main className="developers-page">
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">CLI + MCP</p>
          <div>
            <h1>Your agent can do the work. Atrax can run the app.</h1>
            <p>Build and deploy, manage access, connect apps, and contribute company knowledge. Use the terminal or connect the agent you already work with.</p>
            <div className="hero-actions"><Link className="button button-orange" href="/docs/quickstart">Install from source <span aria-hidden="true">→</span></Link><Link className="text-link" href="/docs/mcp">Connect MCP <span aria-hidden="true">↗</span></Link></div>
          </div>
        </div>
      </section>

      <section className="section shell cli-orientation">
        <div className="section-split">
          <div className="split-copy">
            <p className="eyebrow">An interface for people and agents</p>
            <h2>Readable commands.<br />Structured results.</h2>
            <p>Use --json for machine-readable command results. Named operations take schema-checked input. Operation writes use a stable request key so an agent can identify the same intent across retries.</p>
            <p>Start with the <Link className="text-link" href="/docs/quickstart">source install</Link>, which uses <code>npm link</code> to make <code>atrax</code> available. The examples below assume that setup. The npm release is still to come.</p>
          </div>
          <nav className="agent-files" aria-label="Agent references">
            <a href="/llms.txt"><span>llms.txt</span><small>Start here: agent documentation index</small></a>
            <a href="/operations.json"><span>operations.json</span><small>Discover operation inputs and outputs</small></a>
            <Link href="/docs/cli"><span>CLI reference</span><small>Commands, options, and JSON envelopes</small></Link>
            <Link href="/docs/mcp"><span>MCP setup</span><small>Connect your own agent</small></Link>
          </nav>
        </div>
      </section>

      <section className="sharing-section" id="private-sharing">
        <div className="shell">
          <div className="section-intro"><p className="eyebrow">Your example, with today’s CLI</p><h2>“Give this reviewer a private link.”</h2><p>An owner or admin’s agent can invite a verified email to one app. This currently takes several operations; a one-command sharing shortcut is not available yet.</p></div>
          <div className="share-recipe-grid">
            <ol className="recipe-steps">
              <li><strong>Check the whole audience</strong><p>Inspect the company audience, existing guest access, and public-web state. Inviting a guest does not remove anyone else’s access.</p></li>
              <li><strong>Invite the email to this app</strong><p>Use an app guest invitation, not workspace membership. Select any published actions they should be able to use.</p></li>
              <li><strong>Return the app URL</strong><p>The recipient opens the emailed invitation, signs in with that exact email, and accepts. The agent returns the stable app URL and invitation status.</p></li>
            </ol>
            <div className="recipe-code">
              <p className="eyebrow">Example · Sends an invitation email</p>
              <pre><code>{String.raw`# First inspect all access paths
atrax call apps.access.get \
  --input '{"appId":"<app-id>"}' --json
atrax call apps.guests.list \
  --input '{"appId":"<app-id>"}' --json
atrax call apps.public.get \
  --input '{"appId":"<app-id>"}' --json

# After reviewing and configuring access
atrax call apps.guests.invite \
  --input '{"appId":"<app-id>","email":"reviewer@example.com","actionNames":[]}' \
  --key invite-reviewer-v1 --json

atrax call apps.get \
  --input '{"appId":"<app-id>"}' --json`}</code></pre>
              <p>An empty <code>actionNames</code> list allows opening the app but grants no business actions. Check and configure audiences before sending the invitation.</p>
            </div>
          </div>
          <div className="sharing-caveat"><strong>What “only this person” means today</strong><p>You can name the exact external guest. Authorized company members retain their configured access, and a selected company audience must contain at least one workspace member. Owners and admins retain management authority. Public web must be off for a private review.</p><Link className="text-link" href="/docs/door">Read the access rules →</Link></div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-intro"><p className="eyebrow">What you can do now</p><h2>From a new app to a connected workspace.</h2></div>
        <div className="command-examples">
          {commands.map(([title, code, copy], index) => <article key={title}><div><span className="eyebrow">0{index + 1}</span><h3>{title}</h3><p>{copy}</p></div><pre><code>{code}</code></pre></article>)}
        </div>
      </section>

      <section className="section shell rule-top">
        <div className="section-split">
          <div className="split-copy"><p className="eyebrow">One permission model</p><h2>Use the same operations from the CLI and MCP.</h2><p>Both interfaces draw from the platform operation registry and check the current person’s permissions. MCP exposes authenticated workspace operations; browser and device sign-in handshakes stay in the login flow.</p></div>
          <div className="cli-details"><h3>Beyond the shortcuts</h3><p><code>atrax call &lt;operation&gt;</code> covers team invitations, app and action audiences, guest access, sessions, backups, and recovery. Use <a href="/operations.json">the operation schemas</a> for exact input and output shapes.</p><h3>Current limits</h3><p>For automated writes, choose a stable <code>--key</code> and reuse it with identical input when retrying. Inspect contracts with <code>atrax operations inspect</code> and workflows with <code>atrax recipes list</code>. Hosted agents and scheduled automation are planned for later.</p></div>
        </div>
      </section>
      <section className="final-cta"><div className="shell final-cta-grid"><div><p className="eyebrow">Start with one useful app</p><h2>Give your agent the quickstart.</h2></div><Link className="button button-orange" href="/docs/quickstart">Open the quickstart <span aria-hidden="true">→</span></Link></div></section>
    </main>
  );
}
