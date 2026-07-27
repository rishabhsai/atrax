"use client";

import { useState } from "react";

const command = "npx atrax-cloud new my-app";

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
        <span>Start in your terminal</span>
        <a href="/agent">Read the agent file ↗</a>
      </div>
      <div className="agent-command-line">
        <span aria-hidden="true">$</span>
        <code>{command}</code>
        <button type="button" onClick={copy} aria-label="Copy the start command">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
