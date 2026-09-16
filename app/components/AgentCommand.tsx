"use client";

import { useId, useRef, useState } from "react";

type SetupOption = { label: string; kind: "command" | "prompt"; text: string };

const setupOptions: SetupOption[] = [
  ...[
  { value: "codex", label: "Codex" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  ].map(({ value, label }): SetupOption => ({
    label,
    kind: "command",
    text: `curl -fsSL https://atrax.run/agents.sh | sh -s -- --client ${value}`,
  })),
  {
    label: "Prompt",
    kind: "prompt",
    text: "Read https://atrax.run/agents.md and help me build or update my app with Atrax. Set it up for my agent, run it locally, and check that it works.",
  },
];

type CopyState = "ready" | "copying" | "copied" | "failed";

function Terminal() {
  const [option, setOption] = useState(setupOptions[0]);
  const { text, kind } = option;
  const isPrompt = kind === "prompt";
  const contentLabel = isPrompt ? "Prompt" : "Command";
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
        <div className="agent-clients" role="group" aria-label="Setup options">
          {setupOptions.map((item) => (
            <button key={item.label} type="button" aria-pressed={option === item} disabled={state === "copying"} onClick={() => { setState("ready"); setOption(item); }}>{item.label}</button>
          ))}
        </div>
        <button className="agent-copy" type="button" aria-label={state === "copied" ? `${contentLabel} copied` : `Copy ${kind}`} onClick={copy} disabled={state === "copying"}>
          {state === "copied" ? <span aria-hidden="true">✓</span> : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>}
          <span>{state === "copied" ? "Copied" : state === "copying" ? "Copying…" : "Copy"}</span>
        </button>
      </div>
      <div className="agent-terminal-command">
        {!isPrompt && <span aria-hidden="true">$</span>}
        <pre ref={field} className={isPrompt ? "agent-prompt" : undefined} tabIndex={0} aria-label={isPrompt ? "Agent setup prompt" : "Terminal setup command"} aria-describedby={statusId}>{isPrompt ? text : <code>{text}</code>}</pre>
      </div>
      <p className={state === "failed" ? "agent-copy-error" : "sr-only"} id={statusId} role="status" aria-live="polite">
        {state === "failed" ? `Couldn’t copy. The ${kind} is selected so you can copy it manually.` : state === "copied" ? `${contentLabel} copied.` : ""}
      </p>
    </div>
  );
}

export function AgentCommand() {
  return (
    <div className="agent-handoff">
      <Terminal />
      <p className="agent-guide-note">If you’re an agent, read <a href="/agents.md">atrax.run/agents.md <span aria-hidden="true">↗</span></a></p>
    </div>
  );
}
