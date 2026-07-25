"use client";

import { useState } from "react";

const command = "tarantula new company-app --template chat";

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
        <span>Give this to your coding agent</span>
        <a href="/llms-full.txt">Agent reference ↗</a>
      </div>
      <div className="agent-command-line">
        <span aria-hidden="true">$</span>
        <code>{command}</code>
        <button type="button" onClick={copy} aria-label="Copy agent setup command">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
