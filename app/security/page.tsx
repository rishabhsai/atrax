import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";

export const metadata = {
  title: "Security",
  description:
    "Company-only apps, verified email guests, current permissions, and scoped access for agents.",
};

const boundaries = [
  [
    "Verified people",
    "People verify their email to sign in. Browser, CLI, and named agent sessions identify the person responsible for the request.",
  ],
  [
    "Current access",
    "Atrax checks current workspace membership, app audiences, and action permissions before work runs. Delegating a call to another app preserves the person's restrictions.",
  ],
  [
    "App isolation",
    "Uploaded code runs behind Atrax's gateway. It receives its own resources and limited permission for the current request. Platform credentials stay outside the app.",
  ],
  [
    "Company knowledge",
    "Library checks access before returning search results or file contents. It stores company knowledge, not API keys, credentials, or secrets; shared credential management is planned separately.",
  ],
  [
    "Public publishing",
    "An admin can publish an app's web assets publicly. That does not make its actions or company Library public.",
  ],
] as const;

export default function SecurityPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <div>
            <h1>Your company&apos;s apps start company-only.</h1>
            <p>
              A new app is available to workspace members. Outside access is a
              separate decision. People, agents, and connected apps follow the
              same current permission checks.
            </p>
            <div className="button-row">
              <Link className="button button-orange" href="/docs/security">
                Read the security model <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section shell security-now">
        <div className="section-split">
          <Reveal className="split-copy">
            <h2>Sharing an app should be a deliberate choice.</h2>
            <p>
              Select a smaller coworker audience for a sensitive app. Invite a
              guest to one app by verified email. Choose which actions they can
              use. Revoke the grant when the work is done.
            </p>
            <p>
              Guest grants add access; they do not remove existing workspace
              access. Review the app audience and public publishing settings
              when a review needs to stay restricted.
            </p>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>How access is enforced</span>
              <span>Current release</span>
            </div>
            <ChipGrid
              note="These checks apply to browser, CLI, MCP, and app requests."
              rows={[
                {
                  label: "Enforced",
                  state: "available" as const,
                  chips: [
                    "verified sessions",
                    "current workspace access",
                    "action permissions",
                    "private app runtime",
                    "Library source permissions",
                  ],
                },
                {
                  label: "Not public",
                  state: "planned" as const,
                  chips: ["app actions", "company Library"],
                },
              ]}
            />
          </Reveal>
        </div>
        <div className="security-ledger security-ledger-below">
          {boundaries.map(([title, copy], index) => (
            <p key={title}>
              <span>0{index + 1}</span>
              <strong>{title}</strong>
              <small>{copy}</small>
            </p>
          ))}
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <h2>See where every check happens.</h2>
          </div>
          <Link className="button button-orange" href="/docs/security">
            Open security docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
