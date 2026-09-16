import type { CSSProperties } from "react";

const disconnectedSteps = [
  "app code",
  "access rules",
  "company files",
  "agent setup",
] as const;

type SegmentProps = { label: string; delay: number; className?: string };

function Segment({ label, delay, className }: SegmentProps) {
  return (
    <li
      className={`compare-seg${className ? ` ${className}` : ""}`}
      style={{ "--seg-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="compare-seg-fill" aria-hidden="true" />
      <span className="compare-seg-label">{label}</span>
    </li>
  );
}

export function CompareStrip({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`panel${dark ? " panel-dark" : ""} compare-panel`}>
      <div className="panel-head">
        <span>How work fits together</span>
        <span>One workspace</span>
      </div>
      <div className="compare-strip">
        <div className="compare-row">
          <p className="compare-row-head">
            <span className="microlabel">Separate tools</span>
            <small>app code, access, files, and agent setup</small>
          </p>
          <ol className="compare-track">
            {disconnectedSteps.map((step, index) => (
              <Segment delay={index * 130} key={step} label={step} />
            ))}
          </ol>
        </div>
        <div className="compare-row">
          <p className="compare-row-head">
            <span className="microlabel">
              <b>Atrax</b>
            </span>
            <small>one workspace with explicit boundaries</small>
          </p>
          <ol className="compare-track compare-track-accent">
            <Segment delay={650} label="app contract + workspace" />
            <Segment
              className="compare-seg-result"
              delay={820}
              label="checked actions and knowledge"
            />
          </ol>
        </div>
        <p className="compare-caption">
          Atrax keeps deployment, current access, named actions, Library
          history, and MCP operations in one workspace.
        </p>
      </div>
    </div>
  );
}
