import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { products, solutions } from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(solutions).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = Object.values(solutions).find(
    (candidate) => candidate.slug === slug,
  );
  if (!solution) return {};
  return {
    title: solution.name,
    description: solution.summary,
  };
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = Object.values(solutions).find(
    (candidate) => candidate.slug === slug,
  );
  if (!solution) notFound();

  return (
    <main>
      <section className="page-hero page-hero-dark">
        <div className="shell page-hero-grid">
          <div>
            <h1>{solution.title}</h1>
            <p>{solution.summary}</p>
            <div className="button-row">
              <Link className="button button-orange" href={solution.docs}>
                {solution.docsLabel} <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-outline-light" href="/solutions">
                All use cases
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell example-detail">
        <div className="section-split">
          <Reveal className="split-copy">
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
              <span>An example request</span>
              <span>You + your agent</span>
            </div>
            <dl className="spec-table">
              <div>
                <dt>You ask</dt>
                <dd>{solution.prompt}</dd>
              </div>
              <div>
                <dt>The result</dt>
                <dd>{solution.outcome}</dd>
              </div>
              <div>
                <dt>Good to know</dt>
                <dd>{solution.note}</dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      <section className="example-stack">
        <div className="shell">
          <div>
            {solution.stack.map((slug) => (
              <Link href={`/products/${slug}`} key={slug}>
                <strong>{products[slug].name}</strong>
                <span
                  className={`status status-${products[slug].availability}`}
                >
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
            <h2>{solution.docsLabel}.</h2>
          </div>
          <Link className="button button-orange" href={solution.docs}>
            Read the guide <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
