import Link from "next/link";
import type { CSSProperties } from "react";
import { products, type ProductSlug } from "../lib/content";

type ProductMarkProps = { type: ProductSlug };

export function ProductMark({ type }: ProductMarkProps) {
  const symbols: Record<ProductSlug, string> = {
    launchpad: "↗",
    door: "○",
    library: "□",
    switchboard: "⌁",
    mcp: "✦",
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
  { kind: "note", text: "# From a source checkout" },
  { kind: "cmd", text: "node bin/atrax.mjs new team-chat --template chat" },
  { kind: "cmd", text: "cd team-chat" },
  { kind: "cmd", text: "node ../bin/atrax.mjs deploy --json" },
  { kind: "gap" },
  {
    kind: "out",
    text: `{
  "schemaVersion": 1,
  "result": {
    "appId": "<app-id>",
    "workspaceId": "<workspace-id>",
    "url": "https://<app-host>/"
  }
}`,
  },
];

type DeployTerminalProps = { compact?: boolean; sequence?: boolean };

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
        <span>
          <i />
          <i />
          <i />
        </span>
        <span>CLI example</span>
        <span>JSON output</span>
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
      <Link href="/docs/cli">
        Read the CLI reference <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function ProductConsole({ type }: ProductMarkProps) {
  const product = products[type];
  return (
    <div className="product-console">
      <div className="product-console-head">
        <span>
          {product.number} / {product.name}
        </span>
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
