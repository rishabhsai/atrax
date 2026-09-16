import Link from "next/link";
import { ChipGrid } from "../components/ChipGrid";
import { Reveal } from "../components/Reveal";
import { ProductMark } from "../components/Visuals";
import { productOrder, products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Company apps, access, named actions, Library, and MCP for existing agents.",
};

const availabilityRows = [
  {
    label: "Available",
    state: "available" as const,
    chips: productOrder
      .filter((slug) => products[slug].availability === "available")
      .map((slug) => products[slug].name),
  },
  {
    label: "Deferred",
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
            <h1>One company workspace, clear responsibilities.</h1>
            <p>
              Atrax ships apps, access, Library, named actions, and MCP for an
              existing agent.
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
              01 · <b>Clear boundaries</b>
            </p>
            <h2>Each surface has one job.</h2>
            <p>
              The app runtime does not own identity. An action does not expose a
              raw database. Library guidance does not become an unbounded source
              of access. These boundaries keep the workspace understandable when
              people and agents both use it.
            </p>
            <ChipGrid
              note="Automation is planned for a later release."
              rows={availabilityRows}
            />
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Responsibility</span>
              <span>Product surface</span>
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
            <p className="eyebrow">Available workflow</p>
            <h2>Build and share a company app.</h2>
          </div>
          <Link className="button button-orange" href="/docs/quickstart">
            Read the quickstart <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
