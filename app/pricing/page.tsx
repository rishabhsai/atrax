import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";

export const metadata = {
  title: "Pricing",
  description: "Local development is available now. Hosted pricing and commercial plans are not yet published.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Pricing</p>
          <div>
            <h1>Try the workflow. Hosted pricing is coming.</h1>
            <p>
              Build and run an app locally with the current source release.
              Hosted deployment is working; commercial plans, pricing, and
              published allowances are still being defined.
            </p>
            <div className="button-row">
              <Link className="button button-orange" href="/docs/quickstart">
                Start locally <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section shell pricing-now">
        <div className="section-split section-split-center">
          <Reveal className="split-copy pricing-figure">
            <p className="microlabel">
              01 · <b>Available today</b>
            </p>
            <h2>Get to know Atrax with a real app.</h2>
            <p>
              Install the CLI from source, create an app, and run it on your
              machine without an account. When you deploy, sign in and choose
              a company workspace. You do not need your own Cloudflare account.
            </p>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Release status</span>
              <span>Current scope</span>
            </div>
            <ChipGrid
              note="The npm package release is still forthcoming. Use the source installation in the quickstart."
              rows={[
                {
                  label: "Available",
                  state: "available" as const,
                  chips: [
                    "source checkout",
                    "local development",
                    "workspace deployment",
                    "Library",
                    "MCP",
                  ],
                },
                {
                  label: "Not yet published",
                  state: "planned" as const,
                  chips: [
                    "hosted pricing",
                    "usage limits",
                    "commercial plans",
                  ],
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
            the current release. Hosted agents and scheduled automation are
            planned for later.
          </p>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Start locally</p>
            <h2>Build the app before choosing a plan.</h2>
          </div>
          <Link className="button button-orange" href="/docs/quickstart">
            Open the quickstart <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
