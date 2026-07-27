import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";
import { ProductMark } from "../components/Visuals";
import { productOrder, products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Six products for releases, data, identity, knowledge, tools, and durable execution.",
};

const availabilityRows = [
  {
    label: "Available in v0",
    state: "available" as const,
    chips: productOrder
      .filter((slug) => products[slug].availability === "available")
      .map((slug) => products[slug].name),
  },
  {
    label: "Planned",
    state: "planned" as const,
    chips: productOrder
      .filter((slug) => products[slug].availability === "planned")
      .map((slug) => products[slug].name),
  },
];

export default function ProductsPage() {
  return (
    <main>
      <section className="page-hero page-hero-orange">
        <div className="shell page-hero-grid">
          <p className="eyebrow">Product model</p>
          <div>
            <h1>Six products. One contract.</h1>
            <p>
              One `atrax.json` declares runtime, data, access, files,
              connected tools, and background work, and each product owns one
              job inside it. Launchpad and Tables are available in v0. The
              other four are documented as roadmap so the product can be judged
              without pretending the platform is finished.
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

      <section className="section shell product-rules rule-top">
        <div className="section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>No overlap</b>
            </p>
            <h2>The boundary is part of the product.</h2>
            <p>
              Each product owns one responsibility and hands the next one off by
              name. That is what keeps the contract small enough for an agent to
              hold, and what stops two products from becoming two sources of
              truth.
            </p>
            <ChipGrid
              note="A planned product has a written boundary and no shipped surface. It is not behind a flag."
              rows={availabilityRows}
            />
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Responsibility</span>
              <span>Six products</span>
            </div>
            <dl className="spec-table">
              {productOrder.map((slug) => (
                <div key={slug}>
                  <dt>{products[slug].name}</dt>
                  <dd>{products[slug].boundary}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
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
