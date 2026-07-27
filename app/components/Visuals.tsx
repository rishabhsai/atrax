import type { CSSProperties } from "react";
import { products, type ProductSlug } from "../lib/content";

type ProductMarkProps = {
  type: ProductSlug;
};

export function ProductMark({ type }: ProductMarkProps) {
  const symbols: Record<ProductSlug, string> = {
    launchpad: "↗",
    tables: "▦",
    door: "○",
    library: "□",
    switchboard: "⌁",
    loops: "∞",
  };
  return (
    <span className={`product-mark mark-${type}`} aria-hidden="true">
      {symbols[type]}
    </span>
  );
}

type TerminalLine = { kind: "cmd" | "note" | "out" | "gap"; text?: string };

const deployLines: readonly TerminalLine[] = [
  { kind: "cmd", text: "curl -fsSL https://atrax.run/llms-full.txt" },
  { kind: "note", text: "# agent reads the CLI and app contract" },
  { kind: "gap" },
  { kind: "cmd", text: "atrax new company-app --template chat" },
  { kind: "cmd", text: "cd company-app" },
  { kind: "cmd", text: "atrax deploy --json" },
  { kind: "gap" },
  {
    kind: "out",
    text: `{
  "schemaVersion": 1,
  "status": "deployed",
  "name": "open-chat",
  "url": "https://open-chat...workers.dev",
  "deploymentId": "a13f...",
  "resources": {
    "tables": {
      "id": "1d6f...",
      "name": "open-chat-tables"
    }
  }
}`,
  },
];

type DeployTerminalProps = {
  compact?: boolean;
  /** Stagger the lines in once on load. Reduced motion shows the final state. */
  sequence?: boolean;
};

export function DeployTerminal({
  compact = false,
  sequence = false,
}: DeployTerminalProps) {
  const className = [
    "deploy-terminal",
    compact ? "deploy-terminal-compact" : "",
    sequence ? "deploy-terminal-sequence" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="terminal-bar">
        <span><i /><i /><i /></span>
        <span>deploy / production</span>
        <span>ready</span>
      </div>
      <pre>
        <code>
          {deployLines.map((line, index) => (
            <span
              className={`term-line term-line-${line.kind}`}
              key={line.text ?? `gap-${index}`}
              style={{ "--term-index": index } as CSSProperties}
            >
              {line.kind === "cmd" ? <i aria-hidden="true">$ </i> : null}
              {line.text}
            </span>
          ))}
        </code>
      </pre>
      <a href="/llms-full.txt">
        Open the complete agent reference <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export function AccountPreview() {
  return (
    <div className="account-preview" aria-label="Atrax account project view">
      <div className="account-preview-sidebar">
        <div className="account-preview-brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <strong>atrax</strong>
        </div>
        <nav aria-label="Account preview navigation">
          <span className="is-active">Projects</span>
          <span>Activity</span>
          <span>Connections</span>
          <span>Team</span>
        </nav>
        <small>Company workspace</small>
      </div>
      <div className="account-preview-main">
        <header>
          <div>
            <small>Workspace</small>
            <strong>Your projects</strong>
          </div>
          <span>RS</span>
        </header>
        <div className="account-preview-summary">
          <div><small>Projects</small><strong>—</strong></div>
          <div><small>Healthy</small><strong>—</strong></div>
          <div><small>Last deploy</small><strong>—</strong></div>
        </div>
        <div className="account-preview-table">
          <div className="account-preview-head">
            <span>Project</span><span>Stack</span><span>Status</span><span>Updated</span>
          </div>
          <div className="account-preview-empty">
            <span className="account-orbit" aria-hidden="true"><i /></span>
            <strong>Your first deploy will appear here.</strong>
            <p>Projects register after an authenticated CLI deploy. No provider dashboard scraping.</p>
            <code>atrax deploy --stack prod</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrgFabric() {
  return (
    <div className="mock">
      <div className="fabric-panel">
        <div className="fabric-panel-bar">
          <span className="fabric-panel-title">
            <i aria-hidden="true">A</i> Company workspace
          </span>
          <span className="fabric-panel-meta">4 apps · 4 grants</span>
          <span className="status status-planned">planned</span>
        </div>
        <div className="fabric-plane">
          <svg
            className="fabric-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="fabric-line fabric-line-a"
              d="M 21 60 C 19.5 51, 19 42, 19 33"
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="fabric-line fabric-line-b"
              d="M 32 68 C 45 65, 55 40, 67 24"
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="fabric-line fabric-line-c"
              d="M 68 76 C 58 92, 40 92, 31 79"
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="fabric-line fabric-line-d"
              d="M 79 58 C 79.5 49, 79.5 40, 79 30"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <article className="fabric-node fabric-node-crm">
            <header>
              <ProductMark type="tables" />
              <strong>crm</strong>
            </header>
            <small>Exposes</small>
            <ul>
              <li>read.accounts</li>
              <li>read.contacts</li>
            </ul>
          </article>

          <article className="fabric-node fabric-node-invoices">
            <header>
              <ProductMark type="tables" />
              <strong>invoices</strong>
            </header>
            <small>Exposes</small>
            <ul>
              <li>read.invoices</li>
              <li>read.totals</li>
            </ul>
          </article>

          <article className="fabric-node fabric-node-review">
            <header>
              <ProductMark type="door" />
              <strong>renewal-review</strong>
            </header>
            <small>Exposes</small>
            <ul>
              <li>read.reviews</li>
            </ul>
            <span className="fabric-node-chip">shared · 4 people</span>
          </article>

          <article className="fabric-node fabric-node-digest">
            <header>
              <ProductMark type="loops" />
              <strong>weekly-digest</strong>
            </header>
            <small>Runs</small>
            <ul>
              <li>mon 08:00</li>
            </ul>
          </article>

          <p className="fabric-grant fabric-grant-a">
            renewal-review <b aria-hidden="true">→</b> crm <i>read.accounts</i>
          </p>
          <p className="fabric-grant fabric-grant-b">
            renewal-review <b aria-hidden="true">→</b> invoices{" "}
            <i>read.invoices</i>
          </p>
          <p className="fabric-grant fabric-grant-c">
            weekly-digest <b aria-hidden="true">→</b> renewal-review{" "}
            <i>read.reviews</i>
          </p>
          <p className="fabric-grant fabric-grant-d">
            weekly-digest <b aria-hidden="true">→</b> invoices{" "}
            <i>read.totals</i> <small>until Fri</small>
          </p>
        </div>
        <div className="fabric-caption">
          <p>
            <strong>Typed actions</strong>
            An app publishes named actions. Nothing else about it is reachable.
          </p>
          <p>
            <strong>Narrow grants</strong>
            Another app receives one action, on one resource, for as long as you
            allow.
          </p>
          <p>
            <strong>One ledger</strong>
            Each call records the app, the person behind it, the scope, and the
            result.
          </p>
        </div>
      </div>
      <p className="mock-note">
        Planned interface. Switchboard grants and the action ledger are not
        available yet.
      </p>
    </div>
  );
}

export function ShareSheet() {
  return (
    <div className="mock">
      <div className="share-sheet">
        <div className="share-sheet-head">
          <span className="share-sheet-mark" aria-hidden="true">○</span>
          <div>
            <strong>renewal-review</strong>
            <small>Share access</small>
          </div>
          <span className="status status-planned">planned</span>
        </div>
        <div className="share-invite">
          <span className="share-field">name@example.com</span>
          <span className="share-select">
            Can edit data <i aria-hidden="true">▾</i>
          </span>
          <span className="share-send">Invite</span>
        </div>
        <ul className="share-members">
          <li>
            <span className="share-avatar" aria-hidden="true">RS</span>
            <span>you</span>
            <small>Owner</small>
          </li>
          <li>
            <span className="share-avatar" aria-hidden="true">TM</span>
            <span>teammate@example.com</span>
            <small>Can edit data</small>
          </li>
          <li>
            <span className="share-avatar" aria-hidden="true">OP</span>
            <span>ops@example.com</span>
            <small>Can view</small>
          </li>
        </ul>
        <div className="share-url">
          <code>https://renewal-review...workers.dev</code>
          <span>Copy link</span>
        </div>
      </div>
      <p className="mock-note">
        Planned interface. Door is not available yet.
      </p>
    </div>
  );
}

export function LoopTrace() {
  return (
    <div className="mock">
      <div className="loop-trace">
        <div className="loop-trace-head">
          <span>renewal-review · weekly</span>
          <span className="status status-planned">planned</span>
        </div>
        <pre><code>{products.loops.code}</code></pre>
        <ol className="loop-trace-steps">
          <li>
            <span>mon 08:00</span>
            <strong>started</strong>
            <small>schedule</small>
          </li>
          <li>
            <span>08:00:04</span>
            <strong>read accounts</strong>
            <small>214 rows</small>
          </li>
          <li>
            <span>08:00:11</span>
            <strong>draft outreach</strong>
            <small>6 drafts</small>
          </li>
          <li className="is-paused">
            <span>08:00:12</span>
            <strong>outreach.send</strong>
            <small>paused for approval</small>
            <span className="loop-approve">Approve</span>
          </li>
        </ol>
      </div>
      <p className="mock-note">
        Planned interface. Not a recorded run.
      </p>
    </div>
  );
}

export function ProductConsole({ type }: ProductMarkProps) {
  const product = products[type];
  return (
    <div className="product-console">
      <div className="product-console-head">
        <span>{product.number} / {product.name}</span>
        <span className={`status status-${product.availability}`}>
          {product.availability}
        </span>
      </div>
      <ProductMark type={type} />
      <strong>{product.eyebrow}</strong>
      <p>{product.boundary}</p>
    </div>
  );
}
