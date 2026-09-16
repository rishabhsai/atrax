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
          <p className="eyebrow">The Atrax cloud</p>
          <div>
            <h1>Everything around the app, in one place.</h1>
            <p>
              Build the tool your business needs. Atrax gives it a home, keeps
              its data, manages who can use it, and connects it to your other
              apps and agents.
            </p>
            <div className="button-row">
              <Link className="button button-dark" href="/docs/quickstart">
                Build your first app <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-outline-dark" href="/solutions">
                See what to build
              </Link>
            </div>
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
              <p className="product-index-copy">{product.cardTitle}</p>
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
              01 · <b>Built to work together</b>
            </p>
            <h2>Start with an app. Connect the rest when you need it.</h2>
            <p>
              An internal tracker may only need hosting, data, and team access.
              Add actions when another app needs to use it. Add Library when
              your team and agents need the same company guidance.
            </p>
            <ChipGrid
              note="Automation is planned for a later release."
              rows={availabilityRows}
            />
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>What your business needs</span>
              <span>Atrax provides</span>
            </div>
            <dl className="spec-table">
              {productOrder
                .filter((slug) => products[slug].availability === "available")
                .map((slug) => (
                  <div key={slug}>
                    <dt>{products[slug].name}</dt>
                    <dd>{products[slug].cardTitle}</dd>
                  </div>
                ))}
            </dl>
          </Reveal>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Start locally</p>
            <h2>Put your first idea to work.</h2>
          </div>
          <Link className="button button-orange" href="/docs/quickstart">
            Read the quickstart <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
