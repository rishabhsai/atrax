import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";
import { products, solutions } from "../lib/content";

export const metadata = {
  title: "Use cases",
  description:
    "Company apps, connected business actions, and existing agents operating through MCP.",
};

export default function SolutionsPage() {
  const available = Object.values(products)
    .filter((product) => product.availability === "available")
    .map((product) => product.name);
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <div>
            <h1>Start with work your company needs now.</h1>
            <p>
              Build the tool that fits your work, then give it a stable home,
              the right access, and data that stays with the company.
            </p>
            <div className="button-row">
              <Link className="button button-dark" href="/developers">
                Use the CLI <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="shell example-index">
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
      <section className="section shell fit-check rule-top">
        <div className="section-split">
          <Reveal className="split-copy">
            <h2>Pick one task your team does every week.</h2>
            <p>
              Start with a process you understand. Have your agent build it
              locally, try it yourself, and deploy it for the people doing the
              work. Add connections as the need becomes clear.
            </p>
            <div className="fit-chips">
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
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <h2>Start with the job. Atrax handles the hosting.</h2>
          </div>
          <a className="button button-orange" href="/agents.md">
            Give this to your agent <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
