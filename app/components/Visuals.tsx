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
  { kind: "cmd", text: "atrax new team-chat --template chat" },
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
  const examples: Record<ProductSlug, { label: string; title: string; rows: readonly (readonly [string, string])[] }> = {
    launchpad: { label: "A company app", title: "Build. Deploy. Keep using it.", rows: [["01 · Your machine", "Run the interface and data locally"], ["02 · Your workspace", "Deploy under verified company ownership"], ["03 · Your next update", "Keep the app URL and database"]] },
    door: { label: "New app defaults", title: "Company-only from day one.", rows: [["Workspace members", "Can open the app"], ["Outside guests", "Need an explicit invitation"], ["Public web", "Off until an admin publishes"]] },
    library: { label: "Company knowledge example", title: "“We don’t use blue in our brand.”", rows: [["Contribute", "A person or authorized agent saves it"], ["Find", "Search under current permissions"], ["Correct", "Add a revision and a reason"]] },
    switchboard: { label: "Connected app example", title: "An order reserves its stock.", rows: [["Orders", "orders.create"], ["Inventory", "inventory.stock.reserve"], ["Authorization", "The caller’s current permissions"]] },
    mcp: { label: "Workspace tools", title: "Bring the agent you already use.", rows: [["Discover actions", "atrax_actions_list"], ["Search knowledge", "atrax_library_search"], ["Save a decision", "atrax_library_entry_create"]] },
    loops: { label: "Planned for later", title: "Work that can run on a schedule.", rows: [["Hosted agents", "Planned"], ["Scheduled automation", "Planned"], ["Today", "Connect an existing agent through MCP"]] },
  };
  const example = examples[type];
  return (
    <div className="product-console">
      <div className="product-console-head">
        <span>
          {example.label}
        </span>
        <span className={`status status-${product.availability}`}>
          {product.availability}
        </span>
      </div>
      <strong className="product-example-title">{example.title}</strong>
      <dl className="product-example-rows">
        {example.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </div>
  );
}
