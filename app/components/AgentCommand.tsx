"use client";

import Link from "next/link";
import { useState } from "react";

const command = "node bin/atrax.mjs new team-chat --template chat";

export function AgentCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="agent-command">
      <div className="agent-command-label">
        <span>From a source checkout</span>
        <Link href="/docs/quickstart">Read the quickstart →</Link>
      </div>
      <div className="agent-command-line">
        <span aria-hidden="true">$</span>
        <code>{command}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy the start command"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
