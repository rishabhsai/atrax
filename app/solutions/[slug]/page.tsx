import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
        <div className="section-intro">
          <p className="eyebrow">Example</p>
          <h2>{solution.example}</h2>
        </div>
        <div className="example-steps">
          {solution.steps.map((step, index) => (
            <article key={step}>
              <span>0{index + 1}</span>
              <h3>{step}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="example-stack">
        <div className="shell">
          <p className="eyebrow">Products involved</p>
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
