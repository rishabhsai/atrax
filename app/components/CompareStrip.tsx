import type { CSSProperties } from "react";

const conventionalSteps = [
  "console setup",
  "YAML + IAM",
  "provision each piece",
  "wire secrets",
  "deploy",
] as const;

type SegmentProps = {
  label: string;
  delay: number;
  className?: string;
};

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

/**
 * Two rows of joined segments comparing the number of surfaces a person or
 * agent has to hold, not speed. There are deliberately no timings here: the
 * CLI has no published benchmark, so the honest contrast is steps and outputs.
 *
 * Wrap in `<Reveal>` so the segments fill once, left to right, on entry.
 */
export function CompareStrip({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`panel${dark ? " panel-dark" : ""} compare-panel`}>
      <div className="panel-head">
        <span>Surfaces to operate</span>
        <span>Steps, not timings</span>
      </div>
      <div className="compare-strip">
        <div className="compare-row">
          <p className="compare-row-head">
            <span className="microlabel">A conventional cloud</span>
            <small>five surfaces, five places state can drift</small>
          </p>
          <ol className="compare-track">
            {conventionalSteps.map((step, index) => (
              <Segment delay={index * 130} key={step} label={step} />
            ))}
          </ol>
        </div>

        <div className="compare-row">
          <p className="compare-row-head">
            <span className="microlabel">
              <b>Atrax</b>
            </span>
            <small>one command, one contract</small>
          </p>
          <ol className="compare-track compare-track-accent">
            <Segment delay={780} label="atrax deploy --json" />
            <Segment
              className="compare-seg-result"
              delay={960}
              label="url + versioned JSON state"
            />
          </ol>
        </div>

        <p className="compare-caption">
          The deploy command provisions, migrates, waits for readiness, and
          returns the URL with a versioned JSON record of what it created. This
          compares the number of surfaces you hold, not speed — Atrax
          publishes no benchmark.
        </p>
      </div>
    </div>
  );
}
