import { SupportHero } from "../components/SupportHero";
import styles from "../components/support.module.css";
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
    <main className={styles.page}>
      <SupportHero
        eyebrow="Pricing"
        title="Try the workflow. Hosted pricing is coming."
        description="Build and run an app locally with the released CLI. Hosted deployment is available; commercial plans, pricing, and published allowances are still being defined."
      >
        <Link className="button button-dark" href="/#hero">Start building <span aria-hidden="true">→</span></Link><Link className="text-link" href="/docs">Read the quickstart <span aria-hidden="true">→</span></Link>
      </SupportHero>
      <section className={`${styles.section} ${styles.shell}`}>
        <div className={styles.split}>
          <Reveal className={styles.copy}>
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
        <div className={styles.notes}>
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
      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <h2>Build the app before choosing a plan.</h2>
          </div>
          <Link className="button button-orange" href="/#hero">
            Start building <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
