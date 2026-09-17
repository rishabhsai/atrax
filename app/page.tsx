import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { HeroAtmosphere } from "./components/HeroAtmosphere";
import { ProductMark } from "./components/Visuals";
import { availableProductOrder, products } from "./lib/content";

export const metadata = {
  title: { absolute: "Atrax | A cloud for everyone." },
  description:
    "Build with your agent. Atrax runs your apps, keeps their data, and connects your team.",
};

export default function Home() {
  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <HeroAtmosphere />
        <div className="shell home-intro">
          <h1 id="home-title">A cloud for everyone.</h1>
          <p className="home-summary">Build with your agent. Atrax runs your apps, keeps their data, and connects your team.</p>
          <AgentCommand />
          <p className="home-start-note">Start locally, no account needed. <Link href="/docs/quickstart">Read the quickstart <span aria-hidden="true">→</span></Link></p>
        </div>
      </section>

      <section className="shell home-products" id="products" aria-labelledby="products-title">
        <div className="home-products-intro">
          <h2 id="products-title">Everything around your app.</h2>
          <p>Hosting, a SQL database, access, and shared context. Start with what you need, then connect the rest.</p>
        </div>
        <div className="product-index">
          {availableProductOrder.map((slug) => {
            const product = products[slug];
            return (
              <Link href={`/products/${slug}`} key={slug}>
                <ProductMark type={slug} />
                <h3>{product.name}</h3>
                <p className="product-index-copy">{product.cardTitle}</p>
                <small className={`status status-${product.availability}`}>{product.availability}</small>
                <span className="product-index-arrow" aria-hidden="true">↗</span>
              </Link>
            );
          })}
        </div>
        <div className="home-product-notes">
          <section>
            <h3>For agents</h3>
            <Link href="/products/mcp">MCP <span aria-hidden="true">↗</span></Link>
            <p>Connect the agent you already use to the same workspace operations and permissions.</p>
          </section>
          <section>
            <h3>Planned</h3>
            <Link href="/products/automation">Automation <span aria-hidden="true">↗</span></Link>
            <p>Scheduled work and hosted agents come later. Secrets for shared API keys and credentials are also planned.</p>
          </section>
        </div>
      </section>
      <section className="final-cta">
        <div className="shell final-cta-grid">
          <h2>Put your first idea to work.</h2>
          <a className="button button-orange" href="/agents.md">Give this to your agent <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </main>
  );
}
