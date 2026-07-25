import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { products, solutions, type SolutionSlug } from "../../lib/content";

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
      <section className={`solution-hero-v2 solution-${solution.slug}`}>
        <div className="shell solution-hero-v2-grid">
          <div>
            <p className="section-kicker">Small software / {solution.name}</p>
            <h1>{solution.title}</h1>
          </div>
          <div className="solution-hero-side">
            <p>{solution.summary}</p>
            {solution.slug === "agent-operations" ? (
              <p className="solution-boundary">
                Workers run deterministic code. Operational agents reason with
                tools, preserve state, and can pause for a person.
              </p>
            ) : null}
            <div className="button-row">
              <Link className="button button-primary" href="/company">
                Build with us <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/products">
                See the cloud
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="solution-example-v2">
        <div className="shell solution-example-grid-v2">
          <div>
            <p className="section-kicker">One example</p>
            <h2>{solution.example}</h2>
            <p>{solution.exampleDetail}</p>
          </div>
          <div className="example-app-window">
            <div className="example-app-bar">
              <span>{solution.slug}</span>
              <span><i /> live</span>
            </div>
            <div className="example-app-body">
              <div className="example-app-nav"><i /><i /><i /></div>
              <div className="example-app-main">
                <small>{solution.previewLabel}</small>
                <strong>{solution.example}</strong>
                <div>
                  {solution.previewRows.map((row) => (
                    <p key={row}>{row}</p>
                  ))}
                </div>
              </div>
            </div>
            <div className="example-app-resources">
              {solution.previewStack.map((productSlug) => (
                <span key={productSlug}>{products[productSlug].name}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="shell solution-flow-v2">
        <p className="section-kicker">How it comes together</p>
        <div>
          {solution.flow.map((step, index) => (
            <article key={step}>
              <span>0{index + 1}</span>
              <h2>{step}</h2>
              {index < solution.flow.length - 1 ? <b aria-hidden="true">→</b> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="solution-outcomes-v2">
        <div className="shell solution-outcomes-grid-v2">
          <div>
            <p className="section-kicker">What changes</p>
            <h2>{solution.outcomeTitle}</h2>
          </div>
          <div>
            {solution.outcomes.map((outcome, index) => (
              <p key={outcome}>
                <span>0{index + 1}</span>
                {outcome}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell solution-cloud-stack">
        <div className="section-heading">
          <p className="section-kicker">The cloud underneath</p>
          <h2>Use the pieces the app needs. They already work together.</h2>
        </div>
        <div>
          {solution.stack.map((productSlug) => (
            <Link href={`/products/${productSlug}`} key={productSlug}>
              <span>{products[productSlug].name}</span>
              <p>{products[productSlug].cardTitle}</p>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Private alpha</p>
          <div>
            <h2>Bring us one useful thing that should be software.</h2>
            <Link className="button button-accent" href="/company">
              Request access <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
