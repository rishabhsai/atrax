import Link from "next/link";
import { solutions } from "../lib/content";

export const metadata = {
  title: "What to build",
  description:
    "Small software for teams, individuals, prototypes, and durable agent operations.",
};

export default function SolutionsPage() {
  return (
    <main>
      <section className="build-ideas-hero">
        <div className="shell build-ideas-hero-grid">
          <p className="section-kicker">What to build</p>
          <div>
            <h1>Useful software does not need to become a product.</h1>
            <p>
              The best small software solves one real problem for one person or
              a small group. Tarantula gives it a safe place to live.
            </p>
          </div>
        </div>
      </section>

      <section className="shell build-ideas-grid" aria-label="Ways to use Tarantula">
        {Object.values(solutions).map((solution, index) => (
          <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
            <div className="build-idea-top">
              <span>0{index + 1}</span>
              <span>{solution.eyebrow}</span>
            </div>
            <h2>{solution.name}</h2>
            <p>{solution.short}</p>
            <div className="build-idea-example">
              <span>Example</span>
              <strong>{solution.example}</strong>
            </div>
            <b aria-hidden="true">↗</b>
          </Link>
        ))}
      </section>

      <section className="good-fit-section">
        <div className="shell good-fit-grid">
          <div>
            <p className="section-kicker">The small-software test</p>
            <h2>Use Tarantula when the app is small but deployment, sharing, permissions, or recurring work are not.</h2>
          </div>
          <div className="fit-table">
            <div>
              <span>Good fit</span>
              <p>One person or a small team needs it</p>
              <p>The workflow is specific to how you work</p>
              <p>It needs a real UI, data, permissions, or recurring jobs</p>
              <p>An agent can build and maintain it</p>
            </div>
            <div>
              <span>Probably use something else</span>
              <p>A spreadsheet already works well</p>
              <p>A single automation step solves it</p>
              <p>You are building hyperscale infrastructure</p>
              <p>The app needs bespoke infrastructure, strict multi-region controls, or consumer-scale traffic</p>
            </div>
          </div>
        </div>
      </section>

      <section className="share-story-section">
        <div className="shell share-story-grid">
          <p className="section-kicker">From idea to useful link</p>
          <div className="share-story-steps">
            {[
              ["01", "Describe it", "Give your coding agent the problem and the people it is for."],
              ["02", "Build it", "Use one complete runtime for the interface, data, auth, files, workers, and agents."],
              ["03", "Deploy it", "Run one command. Preview the real app before promoting it."],
              ["04", "Share it", "Invite the people who need it and send one URL."],
            ].map(([index, title, copy]) => (
              <article key={index}>
                <span>{index}</span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-final-cta">
        <div className="shell page-final-cta-grid">
          <p className="section-kicker">What is missing?</p>
          <div>
            <h2>Start with the tool you wish already existed.</h2>
            <Link className="button button-accent" href="/company">
              Join the alpha <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
