import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { solutions, type SolutionSlug } from "../../lib/content";

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
      <section className="solution-detail-hero">
        <div className="shell">
          <p className="eyebrow">{solution.eyebrow}</p>
          <h1>{solution.title}</h1>
          <p className="detail-intro">{solution.summary}</p>
          <div className="button-row">
            <Link className="button button-dark" href="/company">
              Discuss your use case <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="/products">
              Explore the platform <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="shell solution-flow">
        {solution.flow.map((step, index) => (
          <div key={step}>
            <span>0{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </section>

      <section className="section shell outcome-grid">
        <div>
          <p className="eyebrow">What changes</p>
          <h2>Turn a recurring effort into an operating system.</h2>
        </div>
        <div className="outcome-list">
          {solution.outcomes.map((outcome) => (
            <p key={outcome}>
              <span aria-hidden="true">+</span>
              {outcome}
            </p>
          ))}
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell example-grid">
          <div>
            <p className="eyebrow">Example application</p>
            <h2>{solution.example}</h2>
            <p>{solution.exampleDetail}</p>
          </div>
          <div className="example-console">
            <div className="diagram-bar">
              <span>{solution.slug}</span>
              <span className="success-text">production</span>
            </div>
            <div className="example-console-body">
              <p>Latest operating cycle</p>
              <strong>Completed with 4 new findings</strong>
              <div>
                <span>Sources</span>
                <b>12</b>
              </div>
              <div>
                <span>Actions</span>
                <b>03</b>
              </div>
              <div>
                <span>Needs review</span>
                <b>01</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-cta shell">
        <p className="eyebrow">Build your own</p>
        <h2>The best starting point is one painful recurring workflow.</h2>
        <Link className="button button-accent" href="/company">
          Join the private alpha <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
