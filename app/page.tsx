import Link from "next/link";
import { ProductMark, RunTrace, ToolNetwork } from "./components/Visuals";
import { products, solutions } from "./lib/content";

export const metadata = {
  title: "Tarantula — Software that keeps working",
  description:
    "The agent-native platform for building, deploying, and operating complete software.",
};

export default function Home() {
  return (
    <main>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow reveal">The agent-native application platform</p>
          <h1 className="display reveal reveal-delay-1">
            Software that
            <br />
            keeps working.
          </h1>
          <p className="hero-summary reveal reveal-delay-2">
            Give coding agents one coherent runtime for building complete apps
            and operating them continuously.
          </p>
          <div className="button-row reveal reveal-delay-3">
            <Link className="button button-dark" href="/developers">
              Start building <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" href="/products">
              Explore the platform <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="hero-product reveal reveal-delay-2">
          <div className="product-topline">
            <span>Customer health</span>
            <span className="live-state">
              <i /> production
            </span>
          </div>
          <div className="product-command">
            <span className="prompt-mark">›</span>
            <span>Review every account before Monday morning.</span>
          </div>
          <RunTrace />
        </div>
      </section>

      <section className="statement-band">
        <div className="shell statement-grid">
          <p className="section-label">One platform</p>
          <p className="statement">
            An app is no longer just a server waiting for requests. It can
            observe, decide, act, and ask for help—without becoming a pile of
            infrastructure.
          </p>
        </div>
      </section>

      <section className="section shell" id="platform">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">The Tarantula platform</p>
            <h2>Everything an agent needs to ship real software.</h2>
          </div>
          <p>
            Four products, one runtime contract. Build the interface, connect
            the company, and keep the work moving.
          </p>
        </div>
        <div className="product-grid">
          {Object.values(products).map((product, index) => (
            <Link
              className={`product-card product-${product.slug}`}
              href={`/products/${product.slug}`}
              key={product.slug}
            >
              <div className="product-card-head">
                <span className="index">0{index + 1}</span>
                <ProductMark type={product.slug} />
              </div>
              <div>
                <p className="product-name">{product.name}</p>
                <h3>{product.cardTitle}</h3>
                <p>{product.summary}</p>
              </div>
              <span className="card-arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section-dark">
        <div className="shell">
          <div className="section-heading split-heading dark-heading">
            <div>
              <p className="eyebrow">The company network</p>
              <h2>Connect once. Compose forever.</h2>
            </div>
            <p>
              Every app can expose a typed tool. Every tool can be safely
              granted to another app. The company’s software becomes a reusable
              network instead of a set of silos.
            </p>
          </div>
          <ToolNetwork />
          <div className="network-notes">
            <p>
              <span>01</span> Credentials remain in the Vault
            </p>
            <p>
              <span>02</span> Permissions narrow through delegation
            </p>
            <p>
              <span>03</span> Every action leaves a complete trace
            </p>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading">
          <p className="eyebrow">Solutions</p>
          <h2>Built for work that does not fit inside a chat box.</h2>
        </div>
        <div className="solutions-list">
          {Object.values(solutions).map((solution, index) => (
            <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
              <span className="solution-index">0{index + 1}</span>
              <span className="solution-title">{solution.name}</span>
              <span className="solution-copy">{solution.short}</span>
              <span className="solution-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section build-section">
        <div className="shell build-grid">
          <div>
            <p className="eyebrow">Designed for coding agents</p>
            <h2>A small contract. A complete runtime.</h2>
            <p className="build-copy">
              Tarantula is intentionally opinionated. Agents see a compact API,
              predictable file boundaries, and everything they need already in
              context.
            </p>
            <Link className="text-link" href="/developers">
              Read the developer overview <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="code-window">
            <div className="code-title">
              <span>app.ts</span>
              <span>typescript</span>
            </div>
            <pre>
              <code>
                <span className="code-dim">01</span>{" "}
                <span className="code-key">export default</span> app(
                {"{"}
                {"\n"}
                <span className="code-dim">02</span> {"  "}schema, queries,
                mutations,{"\n"}
                <span className="code-dim">03</span> {"  "}endpoints, tasks,
                schedules,{"\n"}
                <span className="code-dim">04</span> {"  "}tools, views{"\n"}
                <span className="code-dim">05</span> {"}"});
                {"\n\n"}
                <span className="code-dim">06</span>{" "}
                <span className="code-comment">
                  {"// one command from local to live"}
                </span>
                {"\n"}
                <span className="code-dim">07</span> $ npx tarantula deploy
              </code>
            </pre>
            <div className="deploy-result">
              <i />
              <span>Deployed in 4.8s</span>
              <span>acme.tarantula.run</span>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-cta shell">
        <p className="eyebrow">Private alpha</p>
        <h2>Build the software your company is missing.</h2>
        <div className="button-row">
          <Link className="button button-accent" href="/company">
            Join the alpha <span aria-hidden="true">↗</span>
          </Link>
          <Link className="text-link" href="/pricing">
            See how access works <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
