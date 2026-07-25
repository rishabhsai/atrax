import Link from "next/link";

export const metadata = {
  title: "Security",
  description:
    "Application identity, scoped grants, short-lived credentials, and complete delegation traces.",
};

export default function SecurityPage() {
  return (
    <main>
      <section className="page-hero security-hero shell">
        <p className="eyebrow">Security architecture</p>
        <h1>Authority should get narrower as software delegates.</h1>
        <p>
          Tarantula treats every human, app, connection, and tool call as a
          distinct identity boundary.
        </p>
      </section>

      <section className="shell security-model">
        <div className="security-chain">
          <div>
            <span>Human</span>
            <strong>maya@acme.com</strong>
          </div>
          <i>→</i>
          <div>
            <span>Calling app</span>
            <strong>customer-health</strong>
          </div>
          <i>→</i>
          <div>
            <span>Company tool</span>
            <strong>outreach.draft</strong>
          </div>
          <i>→</i>
          <div>
            <span>Connection</span>
            <strong>gmail.send</strong>
          </div>
        </div>
        <div className="security-verdict">
          <span>Policy decision</span>
          <strong>Review required</strong>
          <small>Grant cannot expand through delegation</small>
        </div>
      </section>

      <section className="section shell security-principles">
        {[
          ["01", "No ambient authority", "Apps receive explicit grants. Access is never inherited merely because a secret exists in the workspace."],
          ["02", "No raw credential path", "The Vault executes or brokers approved actions without placing permanent credentials inside app code."],
          ["03", "Bound approvals", "Human approval applies to the exact action payload shown, not a vague description of future behavior."],
          ["04", "Complete actor chain", "Every tool call preserves the originating human, calling app, providing app, grant, and policy decision."],
        ].map(([index, title, copy]) => (
          <div key={index}>
            <span>{index}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
        ))}
      </section>

      <section className="security-cta">
        <div className="shell statement-grid">
          <p className="section-label">Design partners</p>
          <div>
            <p className="statement">
              Security is part of the runtime contract, not a dashboard added
              after an agent starts acting.
            </p>
            <Link className="button button-dark" href="/company">
              Discuss your requirements ↗
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
