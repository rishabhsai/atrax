import Link from "next/link";

export const metadata = {
  title: "Developers",
  description:
    "A compact TypeScript application contract built for coding agents.",
};

export default function DevelopersPage() {
  return (
    <main>
      <section className="developer-hero">
        <div className="shell developer-hero-grid">
          <div>
            <p className="eyebrow">Developers</p>
            <h1>One command between an idea and a working system.</h1>
            <p>
              Tarantula is a TypeScript runtime with a deliberately small,
              agent-readable contract. Local and production behavior share the
              same primitives.
            </p>
            <div className="terminal-command">
              <span>$</span>
              <code>npx tarantula new customer-health</code>
              <button type="button" aria-label="Copy command">
                copy
              </button>
            </div>
          </div>
          <div className="developer-manifest">
            <div className="code-title">
              <span>app.ts</span>
              <span>contract v0</span>
            </div>
            <pre>
              <code>{`export default app({
  schema,
  queries,
  mutations,
  endpoints,
  tasks,
  schedules,
  tools,
  views
});`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="shell primitive-table">
        <div className="primitive-row primitive-head">
          <span>Primitive</span>
          <span>Responsibility</span>
          <span>Runtime context</span>
        </div>
        {[
          ["query / mutation", "Application data and reactive state", "ctx.db · ctx.auth"],
          ["endpoint", "External APIs and incoming webhooks", "ctx.env · ctx.log"],
          ["task", "Durable background and agent work", "ctx.ai · ctx.links"],
          ["schedule", "Recurring operational execution", "ctx.run · ctx.time"],
          ["tool", "Typed capability exposed to other apps", "ctx.actor · ctx.grant"],
          ["view", "Private company-facing interface", "useQuery · useAuth"],
        ].map((row) => (
          <div className="primitive-row" key={row[0]}>
            <strong>{row[0]}</strong>
            <span>{row[1]}</span>
            <code>{row[2]}</code>
          </div>
        ))}
      </section>

      <section className="section section-dark">
        <div className="shell cli-grid">
          <div>
            <p className="eyebrow">The loop</p>
            <h2>Build, inspect, and deploy without leaving code.</h2>
          </div>
          <div>
            {[
              ["new", "Create a complete application contract"],
              ["dev", "Run UI, data, tasks, and connections locally"],
              ["inspect", "Read state, grants, runs, and structured logs"],
              ["deploy", "Publish the exact application you tested"],
            ].map(([command, copy]) => (
              <div className="cli-row" key={command}>
                <code>tarantula {command}</code>
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="closing-cta shell">
        <p className="eyebrow">Private alpha</p>
        <h2>We are building with a small group of technical teams.</h2>
        <div className="button-row">
          <Link className="button button-accent" href="/company">
            Request access <span aria-hidden="true">↗</span>
          </Link>
          <Link className="text-link" href="/security">
            Read the security model <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
