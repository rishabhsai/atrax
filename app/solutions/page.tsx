import Link from "next/link";
import { solutions } from "../lib/content";

export const metadata = {
  title: "Solutions",
  description:
    "Operational software for internal systems, customer operations, research, and engineering.",
};

export default function SolutionsPage() {
  return (
    <main>
      <section className="page-hero solutions-hero shell">
        <p className="eyebrow">Solutions</p>
        <h1>Build around the work, not around the software you already bought.</h1>
        <p>
          Tarantula is for important processes that cross tools, need judgment,
          and deserve a real interface.
        </p>
      </section>
      <section className="shell solution-catalog">
        {Object.values(solutions).map((solution, index) => (
          <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
            <div className="solution-catalog-top">
              <span>0{index + 1}</span>
              <span>{solution.eyebrow}</span>
            </div>
            <h2>{solution.name}</h2>
            <p>{solution.short}</p>
            <strong>Explore solution ↗</strong>
          </Link>
        ))}
      </section>
      <section className="section shell solution-callout">
        <p className="eyebrow">A useful boundary</p>
        <h2>
          If it can be a Zap, use a Zap.
          <br />
          If it needs to become software, use Tarantula.
        </h2>
      </section>
    </main>
  );
}
