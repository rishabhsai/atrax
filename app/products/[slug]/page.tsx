import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
        <div className="section-intro">
          <p className="eyebrow">
            {product.availability === "available" ? "Included in v0" : "Planned scope"}
          </p>
          <h2>What belongs here.</h2>
        </div>
        <div className="capability-list">
          {product.features.map(([name, copy], index) => (
            <article key={name}>
              <span>0{index + 1}</span>
              <h3>{name}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="code-section">
        <div className="shell code-section-grid">
          <div>
            <p className="eyebrow">{product.codeLabel}</p>
            <h2>
              {product.availability === "available"
                ? "Use it from the app folder."
                : "The target stays explicit."}
            </h2>
            <p>
              {product.availability === "available"
                ? "This surface is implemented in the deployable chat template."
                : "This is roadmap architecture, not an available CLI promise."}
            </p>
          </div>
          <pre><code>{product.code}</code></pre>
        </div>
      </section>

      <section className="section shell related-products">
        <div className="section-intro">
          <p className="eyebrow">Related products</p>
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
