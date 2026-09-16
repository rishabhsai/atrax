import Image from "next/image";
import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { Reveal } from "./components/Reveal";
import { ProductMark } from "./components/Visuals";
import { productOrder, products } from "./lib/content";

export const metadata = {
  title: "Atrax | A cloud for your company’s software",
  description:
    "Build internal tools with your agent. Deploy company-owned apps, share with verified people, connect app actions, and keep company knowledge in one workspace.",
};

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <Image src="/images/company-cloud.webp" alt="" fill sizes="100vw" preload />
        </div>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Small team. Your own software.</p>
            <h1>A cloud for your company’s software.</h1>
            <p className="hero-summary">
              Build with your agent. Give your team a link. Atrax brings your
              internal apps, their data, and your company knowledge together.
            </p>
            <div className="hero-actions">
              <Link className="button button-orange" href="/docs/quickstart">Build your first app <span aria-hidden="true">→</span></Link>
              <Link className="text-link" href="/solutions">See what you can build <span aria-hidden="true">↗</span></Link>
            </div>
            <p className="hero-note">Company-only by default. No Cloudflare setup required.</p>
          </div>
        </div>
        <div className="hero-rail" aria-label="How Atrax works">
          <span>Build locally</span><span>Deploy from your agent</span><span>Share with your team</span>
        </div>
      </section>

      <section className="section shell work-story" id="use-cases">
        <Reveal className="section-intro">
          <p className="eyebrow">From “we need a tool” to “here’s the link”</p>
          <h2>Start with something your team needs today.</h2>
          <p>A stock tracker. An approval queue. A prototype for a client. Your agent writes the app; Atrax gives it a place to run.</p>
        </Reveal>
        <div className="work-ledger">
          <Link href="/solutions/private-sharing"><span>01</span><div><h3>Share a private prototype</h3><p>Invite a client or reviewer by email. Let them open one app without joining your whole workspace.</p></div><b aria-hidden="true">↗</b></Link>
          <Link href="/solutions/company-apps"><span>02</span><div><h3>Replace the spreadsheet workaround</h3><p>Build the small internal tool that fits the way your team works, with data that stays through updates.</p></div><b aria-hidden="true">↗</b></Link>
          <Link href="/solutions/connected-apps"><span>03</span><div><h3>Let your apps work together</h3><p>An order can reserve stock in your inventory app. Each app exposes named actions with checked permissions.</p></div><b aria-hidden="true">↗</b></Link>
        </div>
      </section>

      <section className="sharing-section" id="sharing">
        <div className="shell section-split section-split-center">
          <Reveal className="split-copy">
            <p className="microlabel">01 · <b>Private sharing</b></p>
            <h2>A link is useful.<br />Knowing who can open it is better.</h2>
            <p>New apps are open to your workspace. Narrow the company audience when needed, or invite an external person to just one app.</p>
            <p>Guests verify their email and accept the invitation. You choose which app actions they can use, and you can revoke access.</p>
            <Link className="text-link" href="/products/door">See how access works <span aria-hidden="true">→</span></Link>
          </Reveal>
          <Reveal className="sharing-example" delay={100}>
            <p className="eyebrow">Example · Prototype review</p>
            <blockquote>“Let our client review this app.”</blockquote>
            <dl className="audience-example">
              <div><dt>Company access</dt><dd>Your configured team audience</dd></div>
              <div><dt>External access</dt><dd>Invited email, verified at sign-in</dd></div>
              <div><dt>Public web</dt><dd>Off</dd></div>
              <div><dt>Guest actions</dt><dd>Only the actions you select</dd></div>
            </dl>
            <p className="example-note">A guest invitation adds that person. It does not remove your existing company audience.</p>
            <Link className="text-link" href="/developers#private-sharing">See the agent workflow <span aria-hidden="true">→</span></Link>
          </Reveal>
        </div>
      </section>

      <section className="products-stage" id="products">
        <div className="shell">
          <Reveal className="section-intro products-stage-intro">
            <p className="microlabel">02 · <b>One company workspace</b></p>
            <h2>The pieces your internal software needs.</h2>
            <p>Company-owned apps, access for your people, named actions for your agents, and knowledge your whole team can use.</p>
          </Reveal>
          <Reveal className="product-ledger">
            {productOrder.filter((slug) => products[slug].availability === "available").map((slug) => {
              const product = products[slug];
              return <Link href={`/products/${slug}`} key={slug}>
                <span className="product-number">{product.number}</span><ProductMark type={slug} />
                <div><h3>{product.name}</h3><p>{product.cardTitle}</p></div>
                <small className="status status-available">Available</small><b aria-hidden="true">↗</b>
              </Link>;
            })}
          </Reveal>
        </div>
      </section>

      <section className="section shell" id="actions">
        <div className="section-split section-split-center">
          <Reveal className="split-copy">
            <p className="microlabel">03 · <b>Apps that work together</b></p>
            <h2>Your next app can use what the last one knows how to do.</h2>
            <p>Expose a named action such as “reserve stock.” Another app or an authorized agent can call it with the right inputs, under the current person’s permissions.</p>
            <p>Your inventory app stays responsible for stock. Your orders app stays responsible for orders.</p>
            <Link className="text-link" href="/docs/inventory-orders">Build the connected example <span aria-hidden="true">→</span></Link>
          </Reveal>
          <Reveal className="action-example" delay={100}>
            <p className="eyebrow">Inventory + Orders · Working example</p>
            <ol>
              <li><span>01</span><div><strong>Create an order</strong><code>orders.create</code></div></li>
              <li><span>02</span><div><strong>Reserve the stock</strong><code>inventory.stock.reserve</code></div></li>
              <li><span>03</span><div><strong>Return the confirmed order</strong><small>Same person. Checked permissions.</small></div></li>
            </ol>
            <p className="example-note">The example uses a stable order key so retrying the same order does not reserve stock twice.</p>
          </Reveal>
        </div>
      </section>

      <section className="knowledge-section" id="library">
        <div className="shell knowledge-grid">
          <Reveal>
            <p className="microlabel">04 · <b>Company Library</b></p>
            <h2>Tell your agent once.<br />Keep it with the company.</h2>
            <p>Policies, brand guidance, documents, and decisions belong in a shared Library. People can upload files. Authorized agents can add knowledge and revise it with a reason.</p>
            <Link className="text-link" href="/products/library">Explore company knowledge <span aria-hidden="true">→</span></Link>
          </Reveal>
          <Reveal className="knowledge-example" delay={100}>
            <p className="eyebrow">For example</p>
            <blockquote>“We don’t use blue in our company. Save that in our brand guidance.”</blockquote>
            <div className="knowledge-receipt"><span>Company Library</span><strong>Brand guidance</strong><p>A saved decision, with its author and revision history. Available to people and agents with access.</p></div>
          </Reveal>
        </div>
      </section>

      <section className="section shell agent-entry" id="agents">
        <div className="section-split">
          <Reveal className="split-copy">
            <p className="microlabel">05 · <b>Built for your agent</b></p>
            <h2>Use the agent you already work with.</h2>
            <p>An existing agent can use the CLI or connect through MCP. It can deploy apps, invite guests, call actions, and contribute to the Library using your current permissions.</p>
            <Link className="text-link" href="/developers">Explore CLI and MCP <span aria-hidden="true">→</span></Link>
          </Reveal>
          <Reveal className="agent-start" delay={100}>
            <p className="eyebrow">Start from the source checkout</p>
            <AgentCommand />
            <p className="example-note">Local development needs no account. Hosted deployment starts with email verification and a workspace. The npm release is still to come.</p>
            <div className="agent-resource-links"><a href="/llms.txt">Agent guide ↗</a><a href="/operations.json">Operation schemas ↗</a><Link href="/docs/mcp">MCP setup →</Link></div>
          </Reveal>
        </div>
        <p className="launch-scope-note">Hosted agents, scheduled automation, and third-party connectors are planned for later. <Link href="/docs/status">See current feature status →</Link></p>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div><p className="eyebrow">One useful app is a good start</p><h2>Build something your team can use tomorrow.</h2></div>
          <Link className="button button-orange" href="/docs/quickstart">Build your first app <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </main>
  );
}
