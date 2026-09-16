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
          <p className="eyebrow">What to build</p>
          <div>
            <h1>Start with work your company needs now.</h1>
            <p>
              Build a workspace-owned app, give it a clear action boundary, keep
              its guidance in Library, and connect the agent you already use
              through MCP.
            </p>
          </div>
        </div>
      </section>
      <section className="shell example-index">
        {Object.values(solutions).map((solution, index) => (
          <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
            <span>0{index + 1}</span>
            <div>
              <p>{solution.eyebrow}</p>
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
            <p className="microlabel">
              01 · <b>Launch fit</b>
            </p>
            <h2>Company work with explicit boundaries.</h2>
            <p>
              Build persistent company apps with current access checks, named
              actions, Library history, and MCP for an existing agent.
            </p>
            <div className="fit-chips">
              <p>One clear workflow</p>
              <p>Company ownership</p>
              <p>Named actions</p>
              <p>Library history</p>
              <p>An existing agent</p>
            </div>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Available surfaces</span>
              <span>Launch</span>
            </div>
            <ChipGrid
              note="Start with the products in your company workflow."
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
    </main>
  );
}
