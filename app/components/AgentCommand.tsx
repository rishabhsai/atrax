"use client";

import { useId, useRef, useState } from "react";

const prompt = "Read https://atrax.run/agents.md and use Atrax to build or resume my app. Start it locally and verify the requested behavior.";
const clients = [
  { value: "codex", label: "Codex" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
];

type CopyState = "ready" | "copying" | "copied" | "failed";

function CopyText({ text, kind }: { text: string; kind: "prompt" | "command" }) {
  const [state, setState] = useState<CopyState>("ready");
  const pending = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const statusId = useId();

  async function copy() {
    if (pending.current) return;
    pending.current = true;
    setState("copying");
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
      field.current?.focus();
      field.current?.select();
    } finally {
      pending.current = false;
    }
  }

  return (
    <div className={`handoff-copy handoff-copy-${kind}`}>
      <textarea
        ref={field}
        aria-label={kind === "prompt" ? "Agent prompt" : "Terminal setup command"}
        aria-describedby={statusId}
        readOnly
        spellCheck={false}
        value={text}
        rows={kind === "prompt" ? 4 : 3}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="handoff-copy-actions">
        <button type="button" onClick={copy} disabled={state === "copying"}>
          {state === "copied" ? "Copied" : state === "copying" ? "Copying…" : `Copy ${kind}`}
          <span aria-hidden="true">{state === "copied" ? "✓" : "↗"}</span>
        </button>
        <p id={statusId} role="status" aria-live="polite">
          {state === "failed" ? "Couldn’t copy. Select the text above and copy it manually." : state === "copied" ? `${kind === "prompt" ? "Prompt" : "Command"} copied.` : ""}
        </p>
      </div>
    </div>
  );
}

export function AgentCommand() {
  const [client, setClient] = useState(clients[0].value);
  const clientId = useId();
  const command = `curl -fsSL https://atrax.run/agents.sh | sh -s -- --client ${client}`;

  return (
    <div className="agent-handoff">
      <div className="handoff-prompt">
        <div className="handoff-heading"><h2>Give this to your agent</h2><a href="/agents.md">Read the guide <span aria-hidden="true">↗</span></a></div>
        <CopyText text={prompt} kind="prompt" />
      </div>
      <div className="handoff-terminal">
        <div className="handoff-heading"><h2>Or set up in your terminal</h2></div>
        <div className="handoff-client"><label htmlFor={clientId}>Your agent</label><select id={clientId} value={client} onChange={(event) => setClient(event.target.value)}>{clients.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></div>
        <CopyText key={client} text={command} kind="command" />
      </div>
    </div>
  );
}
