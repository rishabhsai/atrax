import Link from "next/link";
import { AccountPreview } from "../components/Visuals";

export const metadata = {
  title: "Account",
  description: "The Atrax account control plane for projects, releases, resources, and company connections.",
};

export default function AccountPage() {
  return (
    <main className="account-page">
      <section className="account-page-hero">
        <div className="shell account-page-grid">
          <div>
            <p className="eyebrow">Atrax account</p>
            <h1>Your software, without the provider maze.</h1>
            <p>
              The account console will show every project deployed through
              Atrax, while the CLI remains the fastest way to change it.
            </p>
            <div className="account-auth-note">
              <span>Private alpha</span>
              <p>
                Human sign-in uses Cloudflare Access. CLI access uses a scoped
                device token. Both resolve to the same workspace identity.
              </p>
            </div>
          </div>
          <div className="account-login-card">
            <span className="account-login-mark" aria-hidden="true">A</span>
            <p className="eyebrow">Secure account access</p>
            <h2>Sign in to Atrax</h2>
            <p>
              Account login activates with the private control-plane Worker.
              No password database and no provider credentials in the browser.
            </p>
            <button type="button" disabled>
              Sign in unavailable
            </button>
            <small>Cloudflare Access is not enabled on this account yet.</small>
          </div>
        </div>
      </section>
      <section className="account-page-preview">
        <div className="shell">
          <div className="section-intro">
            <p className="eyebrow">The project view</p>
            <h2>Truth from Atrax state.</h2>
            <p>
              A project appears after an authenticated deploy. The console
              reads Atrax state rather than guessing from provider lists.
            </p>
          </div>
          <AccountPreview />
        </div>
      </section>
      <section className="account-page-flow">
        <div className="shell">
          {[
            ["01", "Sign in", "Cloudflare Access establishes the human workspace identity."],
            ["02", "Link the CLI", "A short-lived device flow issues a scoped token."],
            ["03", "Deploy", "The CLI registers the release and owned resources."],
            ["04", "Operate", "Inspect health, activity, connections, and team access."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Use the working product today</p>
            <h2>Deploy from the CLI.</h2>
          </div>
          <div>
            <code>atrax deploy --json</code>
            <Link className="button button-orange" href="/docs/quickstart">
              Open the quickstart <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
