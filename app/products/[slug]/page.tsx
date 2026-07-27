import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipGrid } from "../../components/ChipGrid";
import { Reveal } from "../../components/Reveal";
import { SpecTable } from "../../components/SpecTable";
import { ProductConsole, ProductMark } from "../../components/Visuals";
import {
  productOrder,
  products,
  type ProductSlug,
} from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return productOrder.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = products[slug as ProductSlug];
  if (!product) return {};
  return {
    title: product.name,
    description: product.summary,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = products[slug as ProductSlug];
  if (!product) notFound();

  const available = product.availability === "available";

  return (
    <main>
      <section className="product-hero">
        <div className="shell product-hero-grid">
          <div>
            <div className="product-kicker">
              <ProductMark type={product.slug} />
              <span>{product.number} / {product.name}</span>
              <small className={`status status-${product.availability}`}>
                {product.availability}
              </small>
            </div>
            <h1>{product.title}</h1>
            <p>{product.summary}</p>
            <div className="button-row">
              <Link className="button button-dark" href={`/docs/${product.slug}`}>
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
          <span>Responsibility</span>
          <p>{product.boundary}</p>
        </div>
      </section>

      <section className="section shell product-capabilities">
        <div className="section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>{available ? "Included in v0" : "Planned scope"}</b>
            </p>
            <h2>What belongs here.</h2>
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
                  ? "Implemented in the deployable chat template."
                  : "Roadmap surface. No CLI command ships this yet."
              }
              meta={product.availability}
              rows={product.spec}
              title="Contract surface"
            />
            <div className="panel">
              <div className="panel-head">
                <span>Hands off to</span>
              </div>
              <ChipGrid
                rows={[
                  {
                    label: "Available",
                    state: "available" as const,
                    chips: product.related
                      .filter((s) => products[s].availability === "available")
                      .map((s) => products[s].name),
                  },
                  {
                    label: "Planned",
                    state: "planned" as const,
                    chips: product.related
                      .filter((s) => products[s].availability === "planned")
                      .map((s) => products[s].name),
                  },
                ].filter((row) => row.chips.length > 0)}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="code-section">
        <div className="shell code-section-grid">
          <div className="split-copy">
            <p className="microlabel">
              02 · <b>{product.codeLabel}</b>
            </p>
            <h2>
              {available
                ? "Use it from the app folder."
                : "The target stays explicit."}
            </h2>
            <p>
              {available
                ? "This surface is implemented in the deployable chat template."
                : "This is roadmap architecture, not an available CLI promise."}
            </p>
          </div>
          <pre><code>{product.code}</code></pre>
        </div>
      </section>

      <section className="section shell related-products">
        <div className="section-intro">
          <p className="microlabel">
            03 · <b>Related products</b>
          </p>
          <h2>Clear handoffs.</h2>
        </div>
        <div>
          {product.related.map((relatedSlug) => {
            const related = products[relatedSlug];
            return (
              <Link href={`/products/${relatedSlug}`} key={relatedSlug}>
                <ProductMark type={relatedSlug} />
                <span>{related.name}</span>
                <small>{related.eyebrow}</small>
                <b aria-hidden="true">↗</b>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
