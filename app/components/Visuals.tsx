import { products, type ProductSlug } from "../lib/content";

type ProductMarkProps = {
  type: ProductSlug;
};

export function ProductMark({ type }: ProductMarkProps) {
  const symbols: Record<ProductSlug, string> = {
    hosting: "↗",
    "agent-runtime": "✦",
    workers: "ƒ",
    database: "▤",
    auth: "◎",
    storage: "□",
    secrets: "⌁",
  };

  return (
    <span className={`product-mark mark-${type}`} aria-hidden="true">
      {symbols[type]}
    </span>
  );
}

export function SmallCloudMap() {
  const resources = [
    ["WEB", "Live"],
    ["DB", "42 rows"],
    ["AUTH", "8 users"],
    ["WORKERS", "3 active"],
    ["AGENTS", "1 running"],
    ["FILES", "18 objects"],
  ];

  return (
    <div className="cloud-map" aria-label="A deployed Tarantula application and its cloud resources">
      <div className="cloud-map-bar">
        <span>renewal-board</span>
        <span className="status-online"><i /> live</span>
      </div>
      <div className="cloud-map-body">
        <div className="cloud-app-preview">
          <div className="preview-sidebar">
            <span className="preview-logo">R</span>
            <i className="active" />
            <i />
            <i />
          </div>
          <div className="preview-main">
            <small>Renewals / this quarter</small>
            <strong>12 accounts need attention</strong>
            <div className="preview-metrics">
              <span><b>42</b> accounts</span>
              <span><b>7</b> at risk</span>
              <span><b>3</b> approvals</span>
            </div>
            <div className="preview-list">
              <i /><i /><i />
            </div>
          </div>
        </div>
        <div className="cloud-resources">
          {resources.map(([name, value]) => (
            <div key={name}>
              <span>{name}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="cloud-map-footer">
        <code>npx tarantula deploy</code>
        <span>renewal-board.tarantula.app ↗</span>
      </div>
    </div>
  );
}

export function SharePanel() {
  return (
    <div className="share-panel" aria-label="Share an internal app with teammates">
      <div className="share-panel-head">
        <span>Share renewal-board</span>
        <span aria-hidden="true">×</span>
      </div>
      <div className="share-link">
        <span>renewal-board.tarantula.app</span>
        <span>Copy link</span>
      </div>
      <div className="share-access">
        <span>Who has access</span>
        <div><i>MC</i><p><strong>Maya Chen</strong><small>Owner</small></p><b>Full access</b></div>
        <div><i>CS</i><p><strong>Customer Success</strong><small>8 people</small></p><b>Can use</b></div>
      </div>
      <span className="share-invite">+ Invite people or teams</span>
    </div>
  );
}

export function AgentRunPanel() {
  return (
    <div className="agent-run-panel" aria-label="A durable agent run">
      <div className="agent-run-head">
        <div>
          <span>AGENT RUN</span>
          <strong>Review upcoming renewals</strong>
        </div>
        <span className="run-live"><i /> running</span>
      </div>
      <div className="agent-run-step complete">
        <span>01</span><i /><p><strong>Load accounts</strong><small>42 records</small></p><time>1.2s</time>
      </div>
      <div className="agent-run-step complete">
        <span>02</span><i /><p><strong>Check usage and support</strong><small>6 tools · 84 calls</small></p><time>41.8s</time>
      </div>
      <div className="agent-run-step active">
        <span>03</span><i /><p><strong>Prepare owner actions</strong><small>Model is working</small></p><time>now</time>
      </div>
      <div className="agent-run-step">
        <span>04</span><i /><p><strong>Request approval</strong><small>Before external action</small></p><time>—</time>
      </div>
      <div className="agent-run-foot">
        <span>Durable · auto-retry on</span><span>$0.38 so far</span>
      </div>
    </div>
  );
}

type ProductConsoleProps = {
  product: {
    slug: ProductSlug;
    name: string;
    diagram: {
      label: string;
      title: string;
      rows: readonly string[];
      result: string;
    };
  };
};

export function ProductConsole({ product }: ProductConsoleProps) {
  return (
    <div className={`product-console console-${product.slug}`}>
      <div className="product-console-top">
        <span>{product.diagram.label}</span>
        <span className="status-online"><i /> healthy</span>
      </div>
      <div className="product-console-title">
        <ProductMark type={product.slug} />
        <div>
          <small>TARANTULA / {product.name.toUpperCase()}</small>
          <strong>{product.diagram.title}</strong>
        </div>
      </div>
      <div className="product-console-rows">
        {product.diagram.rows.map((row, index) => (
          <div key={row}>
            <span>0{index + 1}</span>
            <i />
            <strong>{row}</strong>
          </div>
        ))}
      </div>
      <div className="product-console-result">
        <span>RESULT</span>
        <strong>{product.diagram.result}</strong>
      </div>
    </div>
  );
}

export function ProductDiagram({ type }: ProductMarkProps) {
  return <ProductConsole product={products[type]} />;
}
