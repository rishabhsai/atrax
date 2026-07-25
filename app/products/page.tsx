import Link from "next/link";
import { products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Hosting, agent infrastructure, workers, databases, auth, storage, and secrets for small software.",
};

export default function ProductsPage() {
  const productGroups = [
    {
      name: "Ship",
      description: "Put the app online and run code on requests, events, or schedules.",
      products: [products.hosting, products.workers],
    },
    {
      name: "Store",
      description: "Keep relational data and files beside the app that owns them.",
      products: [products.database, products.storage],
    },
    {
      name: "Control access",
      description: "Know who can use the app and what company systems it can touch.",
      products: [products.auth, products.secrets],
    },
    {
      name: "Operate",
      description: "Run operational agents after deployment.",
      products: [products["agent-runtime"]],
    },
  ];

  return (
    <main>
      <section className="cloud-page-hero">
        <div className="shell cloud-page-hero-grid">
          <p className="section-kicker">A cloud for small software</p>
          <div>
            <h1>Everything a small app needs, built in.</h1>
            <p>
              Deploy apps for one person or one team with hosting, workers, a
              database, auth, files, secrets, and durable agents. One project,
              one deploy, one permission model. Private by default—invite a
              person or team and share the URL like a document.
            </p>
          </div>
        </div>
      </section>

      <section className="cloud-contract-section">
        <div className="shell cloud-contract-grid">
          <div>
            <p className="section-kicker">One app contract</p>
            <h2>One app. One deploy. One permission model.</h2>
            <p>
              Declare what the app needs beside its code. Tarantula runs it
              locally and deploys it together.
            </p>
            <Link className="inline-link" href="/developers">
              See the developer model <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="cloud-contract-map">
            <div className="contract-source">
              <span>YOUR PROJECT</span>
              <strong>renewal-board/</strong>
              <code>app/</code>
              <code>tarantula.ts</code>
            </div>
            <div className="contract-arrow">→</div>
            <div className="contract-runtime">
              <span>TARANTULA CLOUD</span>
              <div>
                {Object.values(products).map((product) => (
                  <i key={product.slug}>{product.name}</i>
                ))}
              </div>
            </div>
            <div className="contract-arrow">→</div>
            <div className="contract-output">
              <span>LIVE APP</span>
              <strong>renewal-board</strong>
              <code>private · 8 users</code>
            </div>
          </div>
        </div>
      </section>

      <section className="shell grouped-products">
        <div className="grouped-products-heading">
          <p className="section-kicker">Products</p>
          <div>
            <h2>Coding agents build the app. Operational agents keep doing the work.</h2>
            <p>Each product is useful alone. Together they are the whole small cloud.</p>
          </div>
        </div>
        <div className="grouped-products-list">
          {productGroups.map((group) => (
            <section key={group.name}>
              <div className="grouped-product-label">
                <h2>{group.name}</h2>
                <p>{group.description}</p>
              </div>
              <ul>
                {group.products.map((product) => (
                  <li key={product.slug}>
                    <Link href={`/products/${product.slug}`}>
                      <div>
                        <h3>{product.name}</h3>
                        <span>{product.eyebrow}</span>
                      </div>
                      <p>{product.summary}</p>
                      <dl>
                        <dt>Included</dt>
                        <dd>{product.features.map(([name]) => name).join(" · ")}</dd>
                      </dl>
                      <strong aria-hidden="true">↗</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">Start small</p>
          <div>
            <h2>Pick one useful app. The cloud is already there.</h2>
            <Link className="button button-accent" href="/company">
              Join the alpha <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
