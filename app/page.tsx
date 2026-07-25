import Image from "next/image";
import Link from "next/link";
import { ProductMark, SharePanel } from "./components/Visuals";
import { products, solutions } from "./lib/content";

export const metadata = {
  title: "Tarantula — The tiny cloud for agent-built software",
  description:
    "Build with an agent, deploy in one command, connect company tools, share knowledge, and invite your team.",
};

const productOrder = [
  products.hosting,
  products.database,
  products.auth,
  products.storage,
  products.secrets,
  products.workers,
  products["agent-runtime"],
] as const;

export default function Home() {
  return (
    <main className="simple-home">
      <section className="simple-hero">
        <div className="shell simple-hero-grid">
          <div className="simple-hero-copy">
            <p className="simple-pill">A tiny cloud for agent-built apps</p>
            <h1>Build it with an agent. Deploy it in one command.</h1>
            <p className="simple-hero-summary">
              Tarantula turns generated code into a private, shareable app—with
              data, login, files, company tools, and operational agents already
              attached.
            </p>

            <div className="hero-command" aria-label="Tarantula deploy command">
              <div>
                <span>Give your coding agent this command</span>
                <small>Works from the app folder</small>
              </div>
              <code><b>$</b> npx tarantula deploy</code>
              <p><i /> Live at renewal-board.tarantula.app</p>
            </div>

            <div className="button-row">
              <Link className="button button-primary" href="/company">
                Join the private alpha <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-quiet" href="/products">
                See what is included
              </Link>
            </div>
          </div>

          <figure className="simple-hero-image">
            <Image
              src="/images/tiny-cloud-hero.jpg"
              alt="A miniature complete cloud with modules for a web app, database, access, files, functions, agents, and connections"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 58vw"
            />
          </figure>
        </div>

        <div className="shell simple-proof">
          {[
            ["01", "Deploy", "One command"],
            ["02", "Private", "From the first request"],
            ["03", "Connect", "Company tools once"],
            ["04", "Share", "Like a document"],
          ].map(([index, title, detail]) => (
            <div key={index}>
              <span>{index}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="simple-intro shell">
        <p className="simple-pill">The whole cloud is already there</p>
        <div>
          <h2>Seven friendly building blocks. No cloud scavenger hunt.</h2>
          <p>
            Your coding agent declares what the app needs. Tarantula creates,
            connects, and deploys it as one project.
          </p>
        </div>
      </section>

      <section className="shell fun-products" aria-label="Tarantula products">
        {productOrder.map((product, index) => (
          <Link
            className={`fun-product fun-product-${product.slug}`}
            href={`/products/${product.slug}`}
            key={product.slug}
          >
            <div className="fun-product-top">
              <ProductMark type={product.slug} />
              <span>0{index + 1}</span>
            </div>
            <div>
              <p>{product.eyebrow}</p>
              <h3>{product.name}</h3>
              <span>{product.cardTitle}</span>
            </div>
            <strong aria-hidden="true">↗</strong>
          </Link>
        ))}
      </section>

      <section className="simple-deploy">
        <div className="shell simple-deploy-grid">
          <div>
            <p className="simple-pill">The easy part should stay easy</p>
            <h2>From repo to real app before the agent loses context.</h2>
            <p>
              Tarantula reads the app contract, previews every change, creates
              the resources, and gives you one URL to share.
            </p>
            <Link className="inline-link" href="/developers">
              See the three-command workflow <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="friendly-terminal">
            <div><span>terminal</span><i /><i /><i /></div>
            <code><b>$</b> npx tarantula deploy</code>
            <p><span>✓</span> Detected Next.js app</p>
            <p><span>✓</span> Created Tables and Door</p>
            <p><span>✓</span> Connected Slack through Switchboard</p>
            <p><span>✓</span> Invited Customer Success</p>
            <strong>renewal-board.tarantula.app ↗</strong>
          </div>
        </div>
      </section>

      <section className="image-feature shell">
        <figure>
          <Image
            src="/images/company-switchboard.jpg"
            alt="A simple central switchboard safely connecting company tools and internal apps"
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />
        </figure>
        <div>
          <p className="simple-pill">Switchboard</p>
          <h2>Connect once. Let your apps help each other.</h2>
          <p>
            Connect Slack, your CRM, an internal API, or another Tarantula app.
            Each app receives a small set of approved tools—not the underlying
            credentials.
          </p>
          <ul>
            <li>One company connection instead of copied keys</li>
            <li>Typed tools that apps can safely expose to each other</li>
            <li>One ledger for every person, app, tool, and action</li>
          </ul>
          <Link className="button button-primary" href="/products/secrets">
            Explore Switchboard <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="image-feature image-feature-reverse shell">
        <figure>
          <Image
            src="/images/company-library.jpg"
            alt="A shared company knowledge library feeding approved information to apps and an operational agent"
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />
        </figure>
        <div>
          <p className="simple-pill">Library</p>
          <h2>Give every app the same trusted company knowledge.</h2>
          <p>
            Store policies, playbooks, notes, files, and generated reports once.
            Apps and agents retrieve only what the current person is allowed to
            see.
          </p>
          <ul>
            <li>Permission-aware search across company knowledge</li>
            <li>Sources, owners, freshness, and retention built in</li>
            <li>No copied folders or one-off vector databases per app</li>
          </ul>
          <Link className="button button-primary" href="/products/storage">
            Explore Library <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="simple-share">
        <div className="shell simple-share-grid">
          <div>
            <p className="simple-pill">Door</p>
            <h2>One URL. The right people. Done.</h2>
            <p>
              Apps start private. Invite a person or team, choose what they can
              do, and send the link. Login and permissions follow the app.
            </p>
            <Link className="inline-link" href="/products/auth">
              See sharing and permissions <span aria-hidden="true">→</span>
            </Link>
          </div>
          <SharePanel />
        </div>
      </section>

      <section className="simple-use-cases shell">
        <div>
          <p className="simple-pill">Start with one useful thing</p>
          <h2>Software too specific to buy. Now easy enough to build.</h2>
        </div>
        <div className="simple-use-case-grid">
          {Object.values(solutions).map((solution) => (
            <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
              <span>{solution.eyebrow}</span>
              <h3>{solution.name}</h3>
              <p>{solution.short}</p>
              <strong aria-hidden="true">↗</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="simple-final">
        <div className="shell">
          <p className="simple-pill">Private alpha</p>
          <h2>Give your agent a smaller cloud to understand.</h2>
          <p>Build the app. Run one command. Share the result.</p>
          <Link className="button button-accent" href="/company">
            Join the alpha <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
