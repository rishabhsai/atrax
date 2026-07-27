import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipGrid } from "../../components/ChipGrid";
import { Reveal } from "../../components/Reveal";
import {
  products,
  solutions,
  type SolutionSlug,
} from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(solutions).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutions[slug as SolutionSlug];
  if (!solution) return {};
  return {
    title: solution.name,
    description: solution.summary,
  };
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = solutions[slug as SolutionSlug];
  if (!solution) notFound();

  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <p className="eyebrow">{solution.eyebrow}</p>
          <div>
            <h1>{solution.title}</h1>
            <p>{solution.summary}</p>
          </div>
        </div>
      </section>

      <section className="section shell example-detail">
        <div className="section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>Example</b>
            </p>
            <h2>{solution.example}</h2>
            <p>{solution.short}</p>
            <ol className="step-list">
              {solution.steps.map((step, index) => (
                <li key={step}>
                  <span>0{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Product stack</span>
              <span>{solution.stack.length} products</span>
            </div>
            <ChipGrid
              note="Steps that depend on a planned product cannot run yet. The available products still deploy the app itself."
              rows={[
                {
                  label: "Available now",
                  state: "available" as const,
                  chips: solution.stack
                    .filter((slug) => products[slug].availability === "available")
                    .map((slug) => products[slug].name),
                },
                {
                  label: "Planned",
                  state: "planned" as const,
                  chips: solution.stack
                    .filter((slug) => products[slug].availability === "planned")
                    .map((slug) => products[slug].name),
                },
              ].filter((row) => row.chips.length > 0)}
            />
          </Reveal>
        </div>
      </section>

      <section className="example-stack">
        <div className="shell">
          <p className="microlabel">
            02 · <b>Products involved</b>
          </p>
          <div>
            {solution.stack.map((slug) => (
              <Link href={`/products/${slug}`} key={slug}>
                <strong>{products[slug].name}</strong>
                <span className={`status status-${products[slug].availability}`}>
                  {products[slug].availability}
                </span>
                <p>{products[slug].cardTitle}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Build the available slice</p>
            <h2>Start with the public chat.</h2>
          </div>
          <Link className="button button-orange" href="/docs/chat-example">
            Open the guide <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
