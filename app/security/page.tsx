import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";

export const metadata = {
  title: "Security",
  description: "Atrax identity, authorization, and data boundaries.",
};

const boundaries = [
  [
    "Identity",
    "Email verification establishes the person behind a workspace, browser session, CLI session, or named agent session.",
  ],
  [
    "Authorization",
    "The trusted gateway checks current membership, app access, action permissions, and revocation before an operation or delegated call.",
  ],
  [
    "App runtime",
    "Uploaded app code runs behind a private binding. It receives its own resources and a narrow request capability, not platform credentials.",
  ],
  [
    "Library",
    "Search filters access before returning content. File bytes require current authorization, and derived material remains restricted by its sources.",
  ],
  [
    "Public pages",
    "An explicit public publish exposes web assets only. App actions and Library remain protected and require a verified person.",
  ],
] as const;

export default function SecurityPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Security model</p>
          <div>
            <h1>Identity and permissions stay outside uploaded app code.</h1>
            <p>
              Atrax makes the company, the current person, and the action
              boundary explicit before it invokes an app or returns company
              knowledge.
            </p>
          </div>
        </div>
      </section>
      <section className="section shell security-now">
        <div className="section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>Access boundary</b>
            </p>
            <h2>Check access where work actually happens.</h2>
            <p>
              Browser, CLI, MCP, and app-to-app calls use the same central
              permission seams. Removing membership or a grant affects existing
              access rather than waiting for a new app version.
            </p>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Scope</span>
              <span>Current release</span>
            </div>
            <ChipGrid
              note="Atrax checks these boundaries for browser, CLI, MCP, and app requests."
              rows={[
                {
                  label: "Enforced",
                  state: "available" as const,
                  chips: [
                    "verified sessions",
                    "current workspace access",
                    "action permissions",
                    "private app runtime",
                    "Library source ACLs",
                  ],
                },
                {
                  label: "Not offered",
                  state: "planned" as const,
                  chips: [
                    "public app actions",
                    "public Library",
                    "third-party connector vault",
                    "hosted agents",
                  ],
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
            <p className="eyebrow">Exact contract</p>
            <h2>Read the security model and operation schemas.</h2>
          </div>
          <Link className="button button-orange" href="/docs/security">
            Open security docs <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
