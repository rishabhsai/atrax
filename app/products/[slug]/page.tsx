import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductConsole, ProductMark } from "../../components/Visuals";
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

  const related = product.related.map(
    (relatedSlug) => products[relatedSlug as ProductSlug],
  );

  return (
    <main>
      <section className={`product-hero-v2 product-hero-${product.slug}`}>
        <div className="shell product-hero-v2-grid">
          <div>
            <p className="section-kicker">Product / {product.name}</p>
            <div className="product-title-lockup">
              <ProductMark type={product.slug} />
              <span>{product.eyebrow}</span>
            </div>
            <h1>{product.title}</h1>
            <p className="product-hero-summary">{product.intro}</p>
            <div className="button-row">
              <Link className="button button-primary" href="/company">
                Join the alpha <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/developers">
                Read the developer model
              </Link>
            </div>
          </div>
          <ProductConsole product={product} />
        </div>
      </section>

      <section className="product-proof-bar">
        <div className="shell">
          <div>
            <strong>{product.stat}</strong>
            <span>{product.statLabel}</span>
          </div>
          <p>{product.summary}</p>
        </div>
      </section>

      <section className="section shell product-features-v2">
        <div className="product-features-intro">
          <p className="section-kicker">What is included</p>
          <h2>Useful defaults, ready in production.</h2>
        </div>
        <div className="product-feature-grid-v2">
          {product.features.map(([name, copy], index) => (
            <article key={name}>
              <span>0{index + 1}</span>
              <h3>{name}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-code-section">
        <div className="shell product-code-v2-grid">
          <div>
            <p className="section-kicker">Declared with the app</p>
            <h2>{product.codeTitle}</h2>
            <p>
              The coding agent declares the resource beside the app. Local
              development and production use the same binding and permission
              contract.
            </p>
          </div>
          <div className="code-card product-code-card">
            <div className="code-card-top">
              <span>tarantula.ts</span>
              <span>{product.name}</span>
            </div>
            <pre><code>{product.code}</code></pre>
            <div className="code-card-result">
              <i />
              <span>Validated locally · ready to deploy</span>
            </div>
          </div>
        </div>
      </section>

      <section className="product-fit-strip">
        <div className="shell">
          <p className="section-kicker">Small-cloud defaults</p>
          <div>
            {product.fit.map((item, index) => (
              <p key={item}><span>0{index + 1}</span><strong>{item}</strong></p>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell related-products-v2">
        <div className="section-heading">
          <p className="section-kicker">Build the whole app</p>
          <h2>Products designed to work as one small cloud.</h2>
        </div>
        <div className="related-products-grid-v2">
          {related.map((item) => (
            <Link href={`/products/${item.slug}`} key={item.slug}>
              <ProductMark type={item.slug} />
              <div>
                <h3>{item.name}</h3>
                <p>{item.cardTitle}</p>
              </div>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Private alpha</p>
          <div>
            <h2>Bring the app idea. Leave the cloud catalog behind.</h2>
            <Link className="button button-accent" href="/company">
              Join private alpha <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
