"use client";

import { useId, useRef, useState } from "react";

const clients = [
  { value: "codex", label: "Codex" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
];

type CopyState = "ready" | "copying" | "copied" | "failed";

function Terminal({ client, onClientChange }: { client: string; onClientChange: (client: string) => void }) {
  const text = `curl -fsSL https://atrax.run/agents.sh | sh -s -- --client ${client}`;
  const [state, setState] = useState<CopyState>("ready");
  const pending = useRef(false);
  const field = useRef<HTMLPreElement>(null);
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
      if (field.current) {
        field.current.focus();
        const range = document.createRange();
        range.selectNodeContents(field.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    } finally {
      pending.current = false;
    }
  }

  return (
    <div className="agent-terminal">
      <div className="agent-terminal-bar">
        <div className="agent-clients" role="group" aria-label="Your agent">
          {clients.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={client === value} disabled={state === "copying"} onClick={() => { setState("ready"); onClientChange(value); }}>{label}</button>
          ))}
        </div>
        <button className="agent-copy" type="button" aria-label={state === "copied" ? "Command copied" : "Copy command"} onClick={copy} disabled={state === "copying"}>
          {state === "copied" ? <span aria-hidden="true">✓</span> : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>}
          <span>{state === "copied" ? "Copied" : state === "copying" ? "Copying…" : "Copy"}</span>
        </button>
      </div>
      <div className="agent-terminal-command">
        <span aria-hidden="true">$</span>
        <pre ref={field} tabIndex={0} aria-label="Terminal setup command" aria-describedby={statusId}><code>{text}</code></pre>
      </div>
      <p className={state === "failed" ? "agent-copy-error" : "sr-only"} id={statusId} role="status" aria-live="polite">
        {state === "failed" ? "Couldn’t copy. The command is selected so you can copy it manually." : state === "copied" ? "Command copied." : ""}
      </p>
    </div>
  );
}

export function AgentCommand() {
  const [client, setClient] = useState(clients[0].value);

  return (
    <div className="agent-handoff">
      <Terminal client={client} onClientChange={setClient} />
      <p className="agent-guide-note">If you’re an agent, read <a href="/agents.md">atrax.run/agents.md <span aria-hidden="true">↗</span></a></p>
    </div>
  );
}
