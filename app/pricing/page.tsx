import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";

export const metadata = {
  title: "Pricing",
  description: "Start with the Atrax source checkout and local development.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Pricing</p>
          <div>
            <h1>Start with the source checkout.</h1>
            <p>
              Build and run company apps locally from the repository. Atrax will
              publish hosted pricing before hosted plans are offered.
            </p>
          </div>
        </div>
      </section>
      <section className="section shell pricing-now">
        <div className="section-split section-split-center">
          <Reveal className="split-copy pricing-figure">
            <p className="microlabel">
              01 · <b>Current scope</b>
            </p>
            <strong>—</strong>
            <h2>Build locally from the repository.</h2>
            <p>
              Install dependencies, create an app, and run it locally. Hosted
              deployment uses a verified workspace; its commercial terms will be
              stated before they are offered.
            </p>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Start here</span>
              <span>Current</span>
            </div>
            <ChipGrid
              note="Hosted pricing will be published before hosted plans are offered."
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
                  label: "Hosted pricing",
                  state: "planned" as const,
                  chips: [
                    "hosted pricing",
                    "usage limits",
                    "free tier",
                    "paid plans",
                  ],
                },
              ]}
            />
          </Reveal>
        </div>
        <div className="pricing-notes">
          <p>
            Hosted pricing, usage limits, and plans will be published before
            they are offered.
          </p>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Start locally</p>
            <h2>Read the source install and quickstart.</h2>
          </div>
          <Link className="button button-orange" href="/docs/quickstart">
            Open the quickstart <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
