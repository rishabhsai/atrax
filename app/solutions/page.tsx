import Link from "next/link";
import { solutions } from "../lib/content";

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

      <section className="section shell fit-check">
        <div className="section-intro">
          <p className="eyebrow">Good v0 fit</p>
          <h2>Public, focused, full-stack.</h2>
        </div>
        <div>
          <p>One small interface</p>
          <p>Structured data in D1</p>
          <p>Public access by design</p>
          <p>A stable URL matters</p>
          <p>A coding agent should operate the deployment</p>
        </div>
      </section>
    </main>
  );
}
