import Link from "next/link";
import { AgentCommand } from "./components/AgentCommand";
import { ChipGrid } from "./components/ChipGrid";
import { CompareStrip } from "./components/CompareStrip";
import { Reveal } from "./components/Reveal";
import { ProductMark } from "./components/Visuals";
import { productOrder, products } from "./lib/content";

export const metadata = {
  title: "Atrax | Company apps, access, and knowledge",
  description:
    "Build company-owned apps, connect named actions, keep knowledge with history, and use an existing agent through MCP.",
};

const contractRows = [
  {
    label: "Available now",
    state: "available" as const,
    chips: [
      "company-owned apps",
      "workspace access",
      "named actions",
      "Library revisions",
      "MCP for an existing agent",
    ],
  },
  {
    label: "Planned",
    state: "planned" as const,
    chips: ["hosted agents", "scheduled automation", "third-party connectors"],
  },
];

export default function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Company software, kept together</p>
            <h1>Build the apps your company actually uses.</h1>
            <p className="hero-summary">
              Build, deploy, and share your company&apos;s apps. Give your team
              and their agents access to the same tools and company knowledge.
            </p>
            <AgentCommand />
            <p className="hero-note">
              Local development needs no account. A hosted deployment begins
              with email verification and a workspace.{" "}
              <Link href="/docs/quickstart">Read the quickstart →</Link>
            </p>
          </div>
        </div>
        <div className="hero-rail" aria-label="Available capabilities">
          <span>Apps</span>
          <span>Access</span>
          <span>Actions</span>
          <span>Library</span>
          <span>MCP</span>
        </div>
      </section>

      <section className="thesis">
        <div className="shell thesis-copy">
          <p className="eyebrow">Why Atrax</p>
          <h2>
            One workspace for the app, the people it serves, and the context it
            needs.
          </h2>
          <p className="thesis-summary">
            A deployed app belongs to a company. Coworkers can open it, a
            maintainer can narrow its audience, another app can call a named
            action, and an existing agent can work through the same current
            permissions.
          </p>
          <nav className="thesis-jump" aria-label="Jump to a section">
            <a href="#products">What is available</a>
            <a href="#actions">Connected actions</a>
            <a href="#library">Company knowledge</a>
            <a href="#agents">Existing agents</a>
          </nav>
        </div>
      </section>

      <section className="compare-section">
        <div className="shell section-split section-split-center">
          <Reveal className="split-copy">
            <p className="microlabel">
              01 · <b>One operating surface</b>
            </p>
            <h2>Make the boundaries readable for people and agents.</h2>
            <p>
              An Atrax app declares its assets, data, and named actions. The
              workspace keeps membership, app access, and Library permissions
              outside uploaded app code.
            </p>
            <p>
              That separation lets a person and an MCP-connected agent use the
              same platform operations without passing credentials through a
              prompt.
            </p>
            <Link className="text-link" href="/docs/app-contract">
              Read the app contract <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <CompareStrip />
          </Reveal>
        </div>
      </section>

      <section className="products-stage" id="products">
        <div className="shell">
          <Reveal className="section-intro products-stage-intro">
            <p className="microlabel">
              02 · <b>Available launch</b>
            </p>
            <h2>Apps, access, actions, Library, and MCP.</h2>
            <p>
              Build and share company apps, connect their actions, keep their
              knowledge current, and bring the agent you already use into the
              same workspace.
            </p>
          </Reveal>
          <Reveal className="product-ledger" delay={100}>
            {productOrder.map((slug) => {
              const product = products[slug];
              return (
                <Link href={`/products/${slug}`} key={slug}>
                  <span className="product-number">{product.number}</span>
                  <ProductMark type={slug} />
                  <div>
                    <h3>{product.name}</h3>
                    <p>{product.cardTitle}</p>
                  </div>
                  <small className={`status status-${product.availability}`}>
                    {product.availability}
                  </small>
                  <b aria-hidden="true">↗</b>
                </Link>
              );
            })}
          </Reveal>
        </div>
      </section>

      <section className="fabric" id="actions">
        <div className="shell section-split section-split-center">
          <Reveal className="split-copy">
            <p className="microlabel">
              03 · <b>Connected work</b>
            </p>
            <h2>Ask another app to do one named thing.</h2>
            <p>
              Apps expose actions with input and output schemas. The target
              checks the current employee’s access before it runs, so a caller
              does not get raw database access or a general credential.
            </p>
            <p>
              Write actions take a stable business key. An interrupted request
              can safely retry the same business intent.
            </p>
            <Link className="text-link" href="/docs/inventory-orders">
              See the Inventory and Orders example{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Action example</span>
              <span>Checked when called</span>
            </div>
            <pre>
              <code>{`orders.create\n  input: { orderId, sku, quantity }\n  effect: write\n  key: order-42\n\ninventory.stock.reserve\n  input: { sku, quantity }\n  effect: write`}</code>
            </pre>
            <p className="compare-caption">
              Atrax checks the action input and current permissions on every
              call.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="share-story" id="library">
        <div className="shell share-grid">
          <Reveal className="share-copy">
            <p className="microlabel">
              04 · <b>Company Library</b>
            </p>
            <h2>Keep the decision, its correction, and its source together.</h2>
            <p>
              Library entries and files record authorship, a revision history,
              and a reason for a correction. Search applies current access
              before titles, snippets, or content are returned.
            </p>
            <p>
              Text, Markdown, CSV, and JSON files are searchable; PDF files are
              stored and available to download. Files are limited to 10 MiB.
            </p>
            <Link className="text-link" href="/docs/library">
              Read Library docs <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Revision example</span>
              <span>History and source access</span>
            </div>
            <pre>
              <code>{`brand-guidance.md\nrevision: <current-revision-id>\nreason: "Correct the product name"\nsource: <source-item-id>\naudience: company`}</code>
            </pre>
            <p className="compare-caption">
              A derived item remains limited by the current permissions on its
              sources.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="agent-docs" id="agents">
        <div className="shell agent-docs-grid">
          <Reveal>
            <p className="eyebrow">Your existing agent</p>
            <h2>Connect it through MCP, with your current permissions.</h2>
            <p>
              Start a named agent session, select a workspace, and run the Atrax
              MCP server. Its tools come from the platform operation registry;
              write tools require a stable key.
            </p>
            <Link className="text-link" href="/docs/mcp">
              Configure MCP <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div
              className="agent-files"
              aria-label="Machine-readable Atrax references"
            >
              <a href="/operations.json">
                <span>operations.json</span>
                <small>operation schemas</small>
              </a>
              <a href="/docs.json">
                <span>docs.json</span>
                <small>documentation manifest</small>
              </a>
              <a href="/llms.txt">
                <span>llms.txt</span>
                <small>agent index</small>
              </a>
              <Link href="/docs/security">
                <span>security model</span>
                <small>access boundaries</small>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="contract-section">
        <div className="shell section-split">
          <Reveal className="split-copy">
            <p className="microlabel">
              05 · <b>Scope</b>
            </p>
            <h2>Build company software now.</h2>
            <p>
              Hosted agents, scheduled automation, automatic external-document
              synchronization, and third-party connectors are planned for a
              later release.
            </p>
            <Link className="text-link" href="/docs/status">
              Read feature status <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
          <Reveal className="panel" delay={120}>
            <div className="panel-head">
              <span>Launch scope</span>
              <span>Current</span>
            </div>
            <ChipGrid
              note="Use available products from the workspace, CLI, or MCP."
              rows={contractRows}
            />
          </Reveal>
        </div>
      </section>

      <section className="final-cta">
        <div className="shell final-cta-grid">
          <div>
            <p className="eyebrow">Start locally</p>
            <h2>Build the first company app from the source checkout.</h2>
          </div>
          <Link className="button button-orange" href="/docs/quickstart">
            Open the quickstart <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
