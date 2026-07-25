import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDiagram } from "../../components/Visuals";
import { products, type ProductSlug } from "../../lib/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(products).map((slug) => ({ slug }));
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

  const related = Object.values(products).filter(
    (item) => item.slug !== product.slug,
  );

  return (
    <main>
      <section className={`product-detail-hero detail-${product.slug}`}>
        <div className="shell detail-hero-grid">
          <div>
            <p className="eyebrow">{product.eyebrow}</p>
            <p className="detail-product-name">Tarantula {product.name}</p>
            <h1>{product.title}</h1>
            <p className="detail-intro">{product.intro}</p>
            <div className="button-row">
              <Link className="button button-dark" href="/company">
                Join the alpha <span aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link" href="/developers">
                View developer overview <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <ProductDiagram type={product.slug} />
        </div>
      </section>

      <section className="section shell product-feature-section">
        <div className="feature-stat">
          <strong>{product.stat}</strong>
          <span>{product.statLabel}</span>
        </div>
        <div className="feature-list">
          {product.features.map(([name, copy], index) => (
            <div key={name}>
              <span>0{index + 1}</span>
              <h2>{name}</h2>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell product-code-grid">
          <div>
            <p className="eyebrow">The contract</p>
            <h2>Small enough for an agent to hold in context.</h2>
            <p>
              The runtime exposes one coherent model locally and in production.
              What the coding agent tests is what the company operates.
            </p>
          </div>
          <div className="code-window code-window-large">
            <div className="code-title">
              <span>{product.slug}.ts</span>
              <span>typescript</span>
            </div>
            <pre>
              <code>{product.code}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <p className="eyebrow">The rest of the platform</p>
          <h2>Designed as one system.</h2>
        </div>
        <div className="related-grid">
          {related.map((item) => (
            <Link href={`/products/${item.slug}`} key={item.slug}>
              <p>{item.eyebrow}</p>
              <h3>{item.name}</h3>
              <span>{item.cardTitle}</span>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
