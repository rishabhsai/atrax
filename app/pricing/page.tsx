import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";

export const metadata = {
  title: "Pricing",
  description:
    "Local development is available now. Hosted pricing and commercial plans are not yet published.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <div>
            <h1>Try the workflow. Hosted pricing is coming.</h1>
            <p>
              Build and run an app locally with the released CLI. Hosted
              deployment is available; commercial plans, pricing, and published
              allowances are still being defined.
            </p>
            <div className="button-row">
              <Link className="button button-orange" href="/developers">
                Use the CLI <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section shell pricing-now">
        <div className="section-split section-split-center">
          <Reveal className="split-copy pricing-figure">
            <h2>Get to know Atrax with a real app.</h2>
            <p>
              Install the CLI, create an app, and run it on your machine without
              an account. When you deploy, sign in and choose a company
              workspace. You do not need your own Cloudflare account.
            </p>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Release status</span>
              <span>Current scope</span>
            </div>
            <ChipGrid
              note="The released CLI supports local development and workspace deployment."
              rows={[
                {
                  label: "Available",
                  state: "available" as const,
                  chips: [
                    "Atrax CLI",
                    "local development",
                    "workspace deployment",
                    "Library",
                    "MCP",
                  ],
                },
                {
                  label: "Not yet published",
                  state: "planned" as const,
                  chips: ["hosted pricing", "usage limits", "commercial plans"],
                },
              ]}
            />
          </Reveal>
        </div>
        <div className="pricing-notes">
          <p>
            Hosted pricing and usage allowances will be published before
            commercial plans are offered. A free hosted tier has not been
            announced.
          </p>
          <p>
            Hosting, persistent app data, team access, Library, and MCP are in
            the current release. Library stores company knowledge; shared API
            key and credential management, hosted agents, and scheduled
            automation are planned for later.
          </p>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <h2>Build the app before choosing a plan.</h2>
          </div>
          <Link className="button button-orange" href="/developers">
            Open the CLI guide <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
