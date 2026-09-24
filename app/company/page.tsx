import { SupportHero } from "../components/SupportHero";
import styles from "../components/support.module.css";
import Link from "next/link";

export const metadata = {
  title: "About Atrax",
  description:
    "A cloud for the software small businesses build for themselves.",
};

export default function CompanyPage() {
  return (
    <main className={styles.page}>
      <SupportHero
        eyebrow="About Atrax"
        title="Your business has its own way of working."
        description="Your software should fit it. Atrax is a cloud for small businesses building and running their own internal tools with the agents they already use."
        artwork="threads"
      >
        <Link className="button button-dark" href="/solutions">Explore the use cases <span aria-hidden="true">→</span></Link>
      </SupportHero>
      <section className={`${styles.section} ${styles.shell} ${styles.thesis}`}>
        <div className={styles.intro}>
          <h2>Atrax started inside a small business.</h2>
        </div>
        <div>
          <p>
            We run a collectible card business with our college roommates,
            buying and selling cards. We use AI to build the tools that run it.
          </p>
          <p>
            Building a tool became the easy part. Sharing it with each other,
            keeping its data, and running it somewhere other than one
            person&apos;s laptop was still harder than it needed to be.
          </p>
          <p>
            So we built the place those tools live. Every small business now
            has the same opportunity and the same problem.
          </p>
        </div>
      </section>
      <section className={`${styles.section} ${styles.shell} ${styles.thesis} ${styles.rule}`}>
        <div className={styles.intro}>
          <h2>The prototype is only the beginning.</h2>
        </div>
        <div>
          <p>
            An agent can build the tool you need. Then people need a link and
            access. The records need to survive the next update. Another app or
            agent may need to ask it to do work.
          </p>
          <p>
            Atrax handles that part. Your apps live in a workspace, with
            data, access, and named actions that other apps and agents can use.
            Shared guidance lives in Library, ready for the next task.
          </p>
          <p>
            Keep your source in GitHub and bring the coding agent you prefer.
            Use Atrax to run what you build.
          </p>
        </div>
      </section>
      <section className={styles.principles}>
        <div className={styles.shell}>
          {[
            [
              "Useful software first",
              "Start with a real task your business needs. Build locally, try it, and deploy it for the people doing the work.",
            ],
            [
              "The company keeps the app",
              "Apps, URLs, and business records belong to the workspace. A teammate leaving should not take the company's tools with them.",
            ],
            [
              "Agents are first-class users",
              "Agents can operate through the CLI and MCP, acting for a verified person with that person's current permissions.",
            ],
            [
              "Knowledge belongs to the team",
              "Save policies, preferences, and decisions where authorized people and agents can find and correct them.",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.cta}>
        <div className={`${styles.shell} ${styles.ctaGrid}`}>
          <div>
            <h2>A cloud for the tools your team needs.</h2>
          </div>
          <div className="button-row">
            <a
              className="button button-orange"
              href="https://github.com/rishabhsai/atrax"
            >
              View GitHub <span aria-hidden="true">↗</span>
            </a>
            <Link className="button button-outline-light" href="/developers">
              Use the CLI
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
