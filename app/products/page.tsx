import Link from "next/link";
import { ProductMark } from "../components/Visuals";
import { productOrder, products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Six products for releases, data, identity, knowledge, tools, and durable execution.",
};

export default function ProductsPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Product model</p>
          <div>
            <h1>Six products. One job each.</h1>
            <p>
              Launchpad and Tables are available in v0. The other four are
              documented as roadmap so the product can be judged without
              pretending the platform is finished.
            </p>
          </div>
        </div>
      </section>

      <section className="shell product-index">
        {productOrder.map((slug) => {
          const product = products[slug];
          return (
            <Link href={`/products/${slug}`} key={slug}>
              <span className="product-number">{product.number}</span>
              <ProductMark type={slug} />
              <div className="product-index-title">
                <p>{product.eyebrow}</p>
                <h2>{product.name}</h2>
              </div>
              <p className="product-index-copy">{product.summary}</p>
              <small className={`status status-${product.availability}`}>
                {product.availability}
              </small>
              <b aria-hidden="true">↗</b>
            </Link>
          );
        })}
      </section>

      <section className="section shell product-rules">
        <div className="section-intro">
          <p className="eyebrow">No overlap</p>
          <h2>The boundary is part of the product.</h2>
        </div>
        <div>
          {productOrder.map((slug) => (
            <p key={slug}>
              <strong>{products[slug].name}</strong>
              <span>{products[slug].boundary}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Working v0</p>
            <h2>Launchpad + Tables can deploy the chat today.</h2>
          </div>
          <Link className="button button-orange" href="/docs/chat-example">
            Read the guide <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
