import { SupportHero } from "../components/SupportHero";
import styles from "../components/support.module.css";
import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";
import { availableProductOrder, products, solutions } from "../lib/content";

export const metadata = {
  title: "Use cases",
  description:
    "Company apps, connected business actions, and existing agents operating through MCP.",
};

export default function SolutionsPage() {
  const available = availableProductOrder.map((slug) => products[slug].name);
  return (
    <main className={styles.page}>
      <SupportHero
        eyebrow="Use cases"
        title="Start with work your company needs now."
        description="Build the tool that fits your work, then give it a stable home, the right access, and data that stays with the company."
        artwork="apps"
      >
        <Link className="button button-dark" href="/#hero">Start building <span aria-hidden="true">→</span></Link>
      </SupportHero>
      <section className={`${styles.shell} ${styles.index}`}>
        {Object.values(solutions).map((solution) => (
          <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
            <div>
              <h2>{solution.name}</h2>
            </div>
            <p>{solution.short}</p>
            <b aria-hidden="true">↗</b>
          </Link>
        ))}
      </section>
      <section className={`${styles.section} ${styles.shell} ${styles.rule}`}>
        <div className={styles.split}>
          <Reveal className={styles.copy}>
            <h2>Pick one task your team does every week.</h2>
            <p>
              Start with a process you understand. Have your agent build it
              locally, try it yourself, and deploy it for the people doing the
              work. Add connections as the need becomes clear.
            </p>
            <div className={styles.chips}>
              <p>Request tracking</p>
              <p>Client reviews</p>
              <p>Inventory tools</p>
              <p>Company guidance</p>
            </div>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Included in the workflow</span>
              <span>Available now</span>
            </div>
            <ChipGrid
              note="Bring your own coding agent. Hosted agents and schedules are planned for later."
              rows={[
                {
                  label: "Available",
                  state: "available" as const,
                  chips: available,
                },
              ]}
            />
          </Reveal>
        </div>
      </section>
      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <h2>Start with the job. Atrax handles the hosting.</h2>
          </div>
          <Link className="button button-orange" href="/#hero">
            Start building <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
