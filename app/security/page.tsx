import Link from "next/link";

export const metadata = {
  title: "Security",
  description:
    "Sandboxed apps, company identity, scoped connections, bound approvals, and complete traces for agent-built software.",
};

export default function SecurityPage() {
  return (
    <main>
      <section className="security-hero-v2">
        <div className="shell security-hero-v2-grid">
          <p className="section-kicker">Security for small software</p>
          <div>
            <h1>Run agent-built code with explicit boundaries.</h1>
            <p>
              Every app starts isolated and private. It can reach only the
              people, data, network destinations, company tools, and actions
              you grant.
            </p>
          </div>
        </div>
      </section>

      <section className="shell security-layers-v2">
        <div className="security-layers-heading">
          <p className="section-kicker">Four boundaries</p>
          <h2>Security is part of the runtime contract.</h2>
        </div>
        <div className="security-layer-grid">
          {[
            ["01", "Sandbox the code", "Each app runs inside its own compute, storage, resource, and network boundary."],
            ["02", "Isolate the tenant", "Apps are isolated from each other. Workspaces are isolated from other customers."],
            ["03", "Grant capabilities", "Apps receive narrow permissions and company-tool actions—not ambient access or raw keys."],
            ["04", "Trace the outcome", "Every sensitive path preserves the user, app, delegated scope, approval, call, and result."],
          ].map(([index, title, copy]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="threat-model-section">
        <div className="shell threat-model-grid">
          <div>
            <p className="section-kicker">Runtime threat model</p>
            <h2>Generated code begins in a default-deny environment.</h2>
          </div>
          <div className="threat-model-list">
            <p><span>Compute</span><strong>Per-app sandbox with CPU, memory, execution-time, and concurrency limits</strong></p>
            <p><span>Storage</span><strong>App-scoped namespaces and control-plane authorization on every management action</strong></p>
            <p><span>Network</span><strong>Default-deny egress with explicit destinations or brokered company-tool calls</strong></p>
            <p><span>Build</span><strong>Dependency installation and build execution isolated from production credentials</strong></p>
            <p><span>Operations</span><strong>Runtime patching, backups, restore testing, and bounded retention policies</strong></p>
          </div>
        </div>
      </section>

      <section className="authority-section">
        <div className="shell authority-grid">
          <div>
            <p className="section-kicker">Authority only gets narrower</p>
            <h2>One action. Every actor visible.</h2>
            <p>
              When an agent calls another app or company service, the original
              user and the exact delegated permission travel with it.
            </p>
          </div>
          <div className="authority-trace">
            <div className="authority-trace-head">
              <span>AUTHORIZATION TRACE</span>
              <strong>Review required</strong>
            </div>
            {[
              ["HUMAN", "maya@acme.com", "renewals.approve"],
              ["APP", "renewal-board", "accounts.read · outreach.draft"],
              ["AGENT", "review-renewals", "outreach.draft"],
              ["TOOL", "customer-comms.draft", "draft only"],
              ["CONNECTION", "gmail", "no send authority"],
            ].map(([kind, actor, scope], index) => (
              <div className="authority-trace-row" key={kind}>
                <span>0{index + 1}</span>
                <i />
                <div><small>{kind}</small><strong>{actor}</strong></div>
                <code>{scope}</code>
              </div>
            ))}
          <div className="authority-trace-result">
              <span>DECISION</span>
              <p>Draft allowed. Sending requires Maya&apos;s approval.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="vault-security-section">
        <div className="shell vault-security-grid">
          <div className="vault-card">
            <div className="vault-card-head">
              <span>COMPANY VAULT</span><span>3 connections</span>
            </div>
            <div className="vault-connection">
              <i>H</i><div><strong>HubSpot</strong><small>Connected by Maya</small></div><span>Healthy</span>
            </div>
            <div className="vault-connection">
              <i>S</i><div><strong>Slack</strong><small>Acme workspace</small></div><span>Healthy</span>
            </div>
            <div className="vault-grant">
              <span>ACTIVE GRANT</span>
              <strong>renewal-board → hubspot.accounts.read</strong>
              <small>Production only · short lived · revocable</small>
            </div>
          </div>
          <div>
            <p className="section-kicker">Company vault</p>
            <h2>The app gets a capability, not a credential.</h2>
            <p>
              Connect keys, OAuth accounts, and internal services once. Apps
              request typed actions; raw credentials stay encrypted inside the
              vault. Tarantula brokers the action or issues a narrow,
              short-lived token only when the provider requires it.
            </p>
            <ul className="check-list security-check-list">
              <li>Scope by app, action, data, environment, and time</li>
              <li>Rotate or revoke a connection without editing app code</li>
              <li>Let apps expose approved typed tools to other apps</li>
            </ul>
            <Link className="inline-link" href="/products/secrets">
              Explore Secrets &amp; Connections <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="approval-invariant">
        <div className="shell approval-invariant-grid">
          <p className="section-kicker">Approval invariant</p>
          <p>
            An approval binds the human, tool, arguments, environment, expiry,
            and one execution. Any payload change requires a new approval.
          </p>
        </div>
      </section>

      <section className="code-isolation-section">
        <div className="shell code-isolation-grid">
          <p className="section-kicker">Arbitrary code, bounded runtime</p>
          <div>
            <h2>Generated code starts with almost nothing.</h2>
            <div className="isolation-list">
              <p><span>Network</span><strong>Denied unless explicitly allowed</strong></p>
              <p><span>Company data</span><strong>Only through authorized app APIs</strong></p>
              <p><span>Secrets</span><strong>Never readable as raw credential values</strong></p>
              <p><span>Other apps</span><strong>Only explicit typed tool calls</strong></p>
              <p><span>Sensitive actions</span><strong>Bound to the exact approved payload</strong></p>
            </div>
          </div>
        </div>
      </section>

      <section className="security-status-section">
        <div className="shell security-status-grid">
          <div>
            <p className="section-kicker">Private-alpha status</p>
            <h2>Clear about what is ready and what is not.</h2>
          </div>
          <div>
            <article><span>ALPHA TARGET</span><p>Per-app sandboxing, workspace isolation, default-deny egress, vault grants, bound approvals, audit traces, backups.</p></article>
            <article><span>IN PROGRESS</span><p>Independent security review, dependency policy, incident runbooks, expanded connector hardening.</p></article>
            <article><span>NOT YET OFFERED</span><p>SOC 2 report, HIPAA workloads, on-premises deployment, or formal enterprise support SLAs.</p></article>
            <a href="mailto:security@tarantula.build">Report a security issue → security@tarantula.build</a>
          </div>
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Design partners</p>
          <div>
            <h2>Bring your security model into the runtime, not after it.</h2>
            <Link className="button button-accent" href="/company">
              Discuss your requirements <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
