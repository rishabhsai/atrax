import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";
import { productOrder, products, solutions } from "../lib/content";

export const metadata = {
  title: "Use cases",
  description:
    "Public tools and prototypes available in v0, plus the private and operational software roadmap.",
};

export default function SolutionsPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">What to build</p>
          <div>
            <h1>Start with one useful app.</h1>
            <p>
              Public tools and prototypes work today on Launchpad and Tables.
              Sharing like a doc, typed actions between apps, and scheduled
              agent work are planned, and depend on Door, Switchboard, Library,
              and Loops.
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
              01 · <b>Good v0 fit</b>
            </p>
            <h2>Public, focused, full-stack.</h2>
            <p>
              The alpha is narrow on purpose. If an app matches every row on the
              right, the current CLI can take it from a folder to a URL today.
              Anything that needs private access or scheduled work waits on a
              planned product.
            </p>
            <div className="fit-chips">
              <p>One small interface</p>
              <p>Structured data in D1</p>
              <p>Public access by design</p>
              <p>A stable URL matters</p>
              <p>A coding agent should operate the deployment</p>
            </div>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Product stack</span>
              <span>v0 status</span>
            </div>
            <ChipGrid
              note="A use case that needs sign-in, company knowledge, connected tools, or schedules depends on a planned product."
              rows={[
                {
                  label: "Runs it today",
                  state: "available" as const,
                  chips: productOrder
                    .filter((slug) => products[slug].availability === "available")
                    .map((slug) => products[slug].name),
                },
                {
                  label: "Planned",
                  state: "planned" as const,
                  chips: productOrder
                    .filter((slug) => products[slug].availability === "planned")
                    .map((slug) => products[slug].name),
                },
              ]}
            />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
