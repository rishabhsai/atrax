import Link from "next/link";

export const metadata = {
  title: "Security",
  description:
    "The implemented v0 security boundary and the planned Door, Switchboard, and Loops model.",
};

export default function SecurityPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Security status</p>
          <div>
            <h1>Clear about the boundary that exists today.</h1>
            <p>
              v0 deploys into your Cloudflare account through your local
              Wrangler session. The generated chat is intentionally public and
              stores messages in its own D1 database.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell security-now">
        <div className="section-intro">
          <p className="eyebrow">Implemented</p>
          <h2>The v0 boundary.</h2>
        </div>
        <div className="security-ledger">
          {[
            ["Cloud account", "The CLI checks the active account against tarantula.lock.json before remote mutation."],
            ["Credentials", "Cloudflare credentials stay in Wrangler. Tarantula stores no API token."],
            ["App state", "Each generated app binds one named D1 database recorded by non-secret ID."],
            ["Input", "The chat validates nickname and message length on the server."],
            ["Rendering", "The browser renders user messages with textContent, not HTML."],
            ["Access", "The chat is public. Anyone with the URL can read and post."],
          ].map(([title, copy], index) => (
            <p key={title}>
              <span>0{index + 1}</span>
              <strong>{title}</strong>
              <small>{copy}</small>
            </p>
          ))}
        </div>
      </section>

      <section className="security-roadmap">
        <div className="shell security-roadmap-grid">
          <div>
            <p className="eyebrow">Planned</p>
            <h2>Identity, capabilities, and execution.</h2>
          </div>
          <div>
            <article>
              <strong>Door</strong>
              <p>Guest identity, private sharing, teams, roles, and app identity.</p>
            </article>
            <article>
              <strong>Switchboard</strong>
              <p>Vaulted connections, typed tools, scoped grants, and an action ledger.</p>
            </article>
            <article>
              <strong>Loops</strong>
              <p>Retries, approval binding, idempotency, durable state, and complete traces.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Read the exact contract</p>
            <h2>Public means public in v0.</h2>
          </div>
          <Link className="button button-orange" href="/docs/security">
            Open security docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
