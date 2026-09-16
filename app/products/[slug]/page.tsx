import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipGrid } from "../../components/ChipGrid";
import { Reveal } from "../../components/Reveal";
import { SpecTable } from "../../components/SpecTable";
import { ProductConsole, ProductMark } from "../../components/Visuals";
import { productOrder, products } from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return productOrder.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = Object.values(products).find(
    (candidate) => candidate.slug === slug,
  );
  if (!product) return {};
  return {
    title: product.name,
    description: product.summary,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = Object.values(products).find(
    (candidate) => candidate.slug === slug,
  );
  if (!product) notFound();

  const available = product.availability === "available";

  return (
    <main>
      <section className="product-hero">
        <div className="shell product-hero-grid">
          <div>
            <div className="product-kicker">
              <ProductMark type={product.slug} />
              <span>
                {product.number} / {product.name}
              </span>
              <small className={`status status-${product.availability}`}>
                {product.availability}
              </small>
            </div>
            <h1>{product.title}</h1>
            <p>{product.summary}</p>
            <div className="button-row">
              <Link
                className="button button-dark"
                href={`/docs/${product.slug}`}
              >
                Read {product.name} docs <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-outline-dark" href="/products">
                All products
              </Link>
            </div>
          </div>
          <ProductConsole type={product.slug} />
        </div>
      </section>

      <section className="product-boundary">
        <div className="shell">
          <p>{product.boundary}</p>
        </div>
      </section>

      <section className="section shell product-capabilities">
        <div className="section-split">
          <Reveal className="split-copy">
            <h2>
              {available
                ? `What you can do with ${product.name}.`
                : "What comes later."}
            </h2>
            <div className="capability-list">
              {product.features.map(([name, copy], index) => (
                <article key={name}>
                  <span>0{index + 1}</span>
                  <h3>{name}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </Reveal>
          <Reveal className="product-spec" delay={120}>
            <SpecTable
              caption={
                available
                  ? "Available in the current release."
                  : "Planned for a later release."
              }
              meta={product.availability}
              rows={product.spec}
              title="The details"
            />
            <div className="panel">
              <div className="panel-head">
                <span>Works with</span>
              </div>
              <ChipGrid
                rows={[
                  {
                    label: "Related",
                    state: "available" as const,
                    chips: product.related.map((slug) => products[slug].name),
                  },
                ]}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="code-section">
        <div className="shell code-section-grid">
          <div className="split-copy">
            <h2>
              {available
                ? "Use this from the CLI or your agent."
                : "Use an existing agent today."}
            </h2>
            <p>
              {available
                ? "Use the CLI for this workflow. Connected agents can discover workspace operations through MCP with the same permission checks."
                : "Connect an existing agent through MCP for request-driven work."}
            </p>
            <Link className="text-link" href="/agents.md">
              Give this to your agent <span aria-hidden="true">→</span>
            </Link>
          </div>
          <pre>
            <code>{product.code}</code>
          </pre>
        </div>
      </section>

      <section className="section shell related-products">
        <div className="section-intro">
          <h2>Related products</h2>
        </div>
        <div>
          {product.related.map((relatedSlug) => {
            const related = products[relatedSlug];
            return (
              <Link href={`/products/${relatedSlug}`} key={relatedSlug}>
                <ProductMark type={relatedSlug} />
                <span>{related.name}</span>
                <b aria-hidden="true">↗</b>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
