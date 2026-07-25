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

export function DeployTerminal({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`deploy-terminal${compact ? " deploy-terminal-compact" : ""}`}>
      <div className="terminal-bar">
        <span><i /><i /><i /></span>
        <span>deploy / production</span>
        <span>ready</span>
      </div>
      <pre><code><span>$</span> curl -fsSL https://tarantula-9l0.pages.dev/llms-full.txt{"\n"}
<b># agent reads the CLI and app contract</b>{"\n\n"}
<span>$</span> tarantula new company-app --template chat{"\n"}
<span>$</span> cd company-app{"\n"}
<span>$</span> tarantula deploy --json{"\n\n"}
<b>{`{
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
}`}</b></code></pre>
      <a href="/llms-full.txt">
        Open the complete agent reference <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export function AccountPreview() {
  return (
    <div className="account-preview" aria-label="Tarantula account project view">
      <div className="account-preview-sidebar">
        <div className="account-preview-brand">
          <span className="brand-mark" aria-hidden="true">T</span>
          <strong>tarantula</strong>
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
            <code>tarantula deploy --stack prod</code>
          </div>
        </div>
      </div>
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
