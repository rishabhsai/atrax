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
        <span>agent / terminal</span>
        <span><i /> verified live</span>
      </div>
      <pre><code><span>$</span> tarantula new open-chat --template chat{"\n"}
<span>$</span> cd open-chat{"\n"}
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
      <a href="https://tarantula-chat-demo.rishabhsai-mdbar.workers.dev">
        Open the deployed reference app <span aria-hidden="true">↗</span>
      </a>
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
