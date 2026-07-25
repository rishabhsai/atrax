import Link from "next/link";
import { ProductMark } from "../components/Visuals";
import { products } from "../lib/content";

export const metadata = {
  title: "Products",
  description:
    "Seven friendly building blocks for deploying, sharing, connecting, and operating small software.",
};

const productDetails = [
  [products.hosting, "web()", "Ship"],
  [products.database, "database()", "Remember"],
  [products.auth, "auth()", "Invite"],
  [products.storage, "storage()", "Know"],
  [products.secrets, "connection()", "Connect"],
  [products.workers, "worker()", "React"],
  [products["agent-runtime"], "agent()", "Operate"],
] as const;

export default function ProductsPage() {
  return (
    <main className="simple-products-page">
      <section className="simple-products-hero">
        <div className="shell">
          <p className="simple-pill">The Tarantula cloud</p>
          <h1>Seven building blocks. One tiny cloud.</h1>
          <p>
            Seven pieces cover deployment, data, login, knowledge, company
            tools, background code, and operational agents. They ship together.
          </p>
          <div className="products-command">
            <code><b>$</b> npx tarantula deploy</code>
            <span>One app · one deploy · one permission model</span>
          </div>
        </div>
      </section>

      <section className="shell products-story">
        {[
          ["01", "Build", "Your coding agent writes one ordinary app."],
          ["02", "Deploy", "Tarantula creates everything it declares."],
          ["03", "Invite", "Send one private URL to a person or team."],
          ["04", "Keep going", "Jobs and agents continue after the tab closes."],
        ].map(([index, title, copy]) => (
          <article key={index}>
            <span>{index}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="shell products-friendly-list">
        <div className="products-friendly-heading">
          <p className="simple-pill">The building blocks</p>
          <div>
            <h2>Friendly on the surface. Literal in code.</h2>
            <p>
              Fun names make the system easier to remember. The TypeScript
              primitives stay unsurprising for coding agents.
            </p>
          </div>
        </div>

        <div className="products-friendly-grid">
          {productDetails.map(([product, primitive, action], index) => (
            <Link
              className={`product-friendly-card product-friendly-${product.slug}`}
              href={`/products/${product.slug}`}
              key={product.slug}
            >
              <div>
                <ProductMark type={product.slug} />
                <span>0{index + 1}</span>
              </div>
              <small>{action} / {product.eyebrow}</small>
              <h3>{product.name}</h3>
              <p>{product.summary}</p>
              <code>{primitive}</code>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="products-one-contract">
        <div className="shell products-one-contract-grid">
          <div>
            <p className="simple-pill">One app contract</p>
            <h2>The pieces know about each other.</h2>
            <p>
              Door permissions apply to Tables and Library. Switchboard tools
              are available to Spark and Loop. Launchpad deploys the complete
              app—not seven separate projects.
            </p>
            <Link className="inline-link" href="/developers">
              Read the developer model <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="contract-snippet">
            <span>tarantula.ts</span>
            <pre><code>{`export default defineApp({
  web: web("./app"),
  database: database({ accounts }),
  auth: auth({ audience: "team" }),
  storage: storage({ knowledge: true }),
  connections: [slack, hubspot],
  agents: [renewalReview]
});`}</code></pre>
            <strong>That is the whole cloud.</strong>
          </div>
        </div>
      </section>

      <section className="simple-final">
        <div className="shell">
          <p className="simple-pill">Start small</p>
          <h2>Pick one useful app. The cloud is already there.</h2>
          <Link className="button button-accent" href="/company">
            Join the alpha <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
