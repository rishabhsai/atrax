import Link from "next/link";
import Image from "next/image";
import { AgentCommand } from "./components/AgentCommand";
import { HeroAtmosphere } from "./components/HeroAtmosphere";
import { Reveal } from "./components/Reveal";
import { ActionStory } from "./components/ActionStory";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main id="main" className={styles["home"]}>
      <section className={styles["hero"]} aria-labelledby="hero-title">
        <HeroAtmosphere />
        <div className={styles["hero-copy"]}>
          <h1 id="hero-title">A cloud for everyone.</h1>
          <p>
            Build with your agent. Atrax runs your apps, keeps their data, and
            connects your team.
          </p>
          <AgentCommand />
          <div className={styles["hero-note"]}>
            Start locally, no account needed.{" "}
            <Link href="/docs/quickstart/">Read the quickstart →</Link>
          </div>
        </div>
        <a className={styles["hero-scroll"]} href="#products">
          Explore Atrax <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section
        className={styles["product-intro"] + " " + styles["shell"]}
        id="products"
        aria-labelledby="products-title"
      >
        <div>
          <p className={styles["section-label"]}>Built to belong together</p>
          <h2 id="products-title">
            Everything around
            <br /> your app.
          </h2>
        </div>
        <div className={styles["intro-right"]}>
          <p>
            Run the app. Keep its data. Bring your team in.
            <br /> The pieces are already connected.
          </p>
          <nav aria-label="Capabilities">
            <a href="#apps">Apps</a>
            <a href="#database">Database</a>
            <a href="#access">Access</a>
            <a href="#library">Library</a>
            <a href="#actions">Actions</a>
          </nav>
        </div>
      </section>

      <section
        className={styles["apps-section"] + " " + styles["shell"]}
        id="apps"
        aria-labelledby="apps-title"
      >
        <div className={styles["apps-composition"]}>
          <div className={styles["apps-copy"]}>
            <p className={styles["section-label"]}>01 / Apps</p>
            <h2 id="apps-title">
              Your idea,
              <br /> up and running.
            </h2>
            <p className={styles["body-copy"]}>
              Build with the agent you already use. Atrax gives your app a home,
              a stable address, and a place in your team&apos;s workspace.
            </p>
            <Link className={styles["text-link"]} href="/docs/apps/">
              Explore Apps <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <Reveal className={styles["apps-art"]}>
            <figure>
              <picture>
                <source
                  media="(max-width: 640px)"
                  srcSet="/images/home/woven-apps-800.webp"
                />
                <Image
                  src="/images/home/woven-apps.webp"
                  width={1536}
                  height={1024}
                  alt=""
                />
              </picture>
              <figcaption>
                A home for your app.
                <br /> A foundation for its data.
              </figcaption>
            </figure>
          </Reveal>
        </div>
        <div className={styles["database-strip"]} id="database">
          <div className={styles["database-name"]}>
            <span className={styles["small-number"]}>02</span>
            <h3>Database</h3>
          </div>
          <div>
            <h4>Its data stays with it.</h4>
            <p>
              Each app gets its own SQL database. Ordinary deployments preserve
              its business data.
            </p>
          </div>
          <Link className={styles["text-link"]} href="/docs/database/">
            How it works <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section
        className={styles["access-section"]}
        id="access"
        aria-labelledby="access-title"
      >
        <div className={styles["shell"]}>
          <div className={styles["access-heading"]}>
            <p className={styles["section-label"]}>03 / Access</p>
            <h2 id="access-title">
              Your team on the inside.
              <br /> Sharing on your terms.
            </h2>
            <p>
              New apps are company-only by default.
              <br /> Choose a narrower audience or invite guests when you need
              to.
            </p>
          </div>
          <div className={styles["access-visual"]}>
            <Reveal className={styles["access-art"]}>
              <picture>
                <source
                  media="(max-width: 640px)"
                  srcSet="/images/home/woven-access-800.webp"
                />
                <Image
                  src="/images/home/woven-access.webp"
                  width={1774}
                  height={887}
                  alt=""
                />
              </picture>
            </Reveal>
            <div className={styles["workspace-center"]}>
              <span className={styles["workspace-symbol"]} aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <strong>Your workspace</strong>
              <span>People. Apps. Shared work.</span>
            </div>
            <div
              className={
                styles["access-caption"] + " " + styles["team-caption"]
              }
            >
              <span>Inside the boundary</span>
              <strong>Your team</strong>
              <p>
                Workspace access
                <br /> by default.
              </p>
            </div>
            <div
              className={
                styles["access-caption"] + " " + styles["guest-caption"]
              }
            >
              <span>A deliberate invitation</span>
              <strong>Your guests</strong>
              <p>
                Access to the apps
                <br /> you share.
              </p>
            </div>
          </div>
          <div className={styles["access-bottom"]}>
            <p>
              A guest invitation adds access without removing your team.
              <br /> Permission to use an app does not grant permission to
              change its code.
            </p>
            <Link className={styles["text-link"]} href="/docs/access/">
              Explore Access <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        className={styles["library-section"]}
        id="library"
        aria-labelledby="library-title"
      >
        <div className={styles["shell"] + " " + styles["library-grid"]}>
          <Reveal className={styles["library-art"]}>
            <figure>
              <picture>
                <source
                  media="(max-width: 640px)"
                  srcSet="/images/home/woven-library-800.webp"
                />
                <Image
                  src="/images/home/woven-library.webp"
                  width={1536}
                  height={1024}
                  alt=""
                />
              </picture>
              <figcaption>
                Files <span aria-hidden="true">·</span> Policies{" "}
                <span aria-hidden="true">·</span> Decisions
              </figcaption>
            </figure>
          </Reveal>
          <div className={styles["library-copy"]}>
            <p className={styles["section-label"]}>04 / Library</p>
            <h2 id="library-title">
              What your company
              <br /> knows, kept together.
            </h2>
            <p className={styles["body-copy"]}>
              Give your people and agents a shared place for company knowledge.
              Save a file, a policy, or a decision so the next task starts with
              the right context.
            </p>
            <Link className={styles["text-link"]} href="/docs/library/">
              Explore Library <span aria-hidden="true">↗</span>
            </Link>
            <div className={styles["knowledge-example"]}>
              <span>Example saved preference</span>
              <blockquote>
                &ldquo;We don&apos;t use blue in our company designs.&rdquo;
              </blockquote>
              <p>
                Deliberately saved. Available to permitted people and agents.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className={styles["actions-section"]}
        id="actions"
        aria-labelledby="actions-title"
      >
        <div className={styles["shell"]}>
          <div className={styles["actions-heading"]}>
            <div>
              <p className={styles["section-label"]}>05 / Actions</p>
              <h2 id="actions-title">
                Separate apps.
                <br /> Connected work.
              </h2>
            </div>
            <div>
              <p className={styles["body-copy"]}>
                Let your apps and agents call the operations your team needs.
                Every call follows the caller&apos;s permissions.
              </p>
              <Link className={styles["text-link"]} href="/docs/actions/">
                Explore Actions <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
          <ActionStory />
        </div>
        <div className={styles["action-weave"]} aria-hidden="true">
          <picture>
            <source
              media="(max-width: 640px)"
              srcSet="/images/home/woven-hero-800.webp"
            />
            <Image
              src="/images/home/woven-hero.webp"
              width={1672}
              height={941}
              alt=""
            />
          </picture>
        </div>
        <div className={styles["shell"] + " " + styles["actions-foot"]}>
          <span>Different apps, the same permission rules.</span>
          <Link href="/docs/inventory-orders/">
            Read the Inventory + Orders walkthrough ↗
          </Link>
        </div>
      </section>

      <section className={styles["closing"] + " " + styles["shell"]}>
        <p className={styles["section-label"]}>
          Made with your agent. Used by your team.
        </p>
        <h2>
          Put your first
          <br /> idea to work.
        </h2>
        <a className={styles["primary-button"]} href="/agents.md">
          Open the agent guide <span aria-hidden="true">↗</span>
        </a>
        <p>Start locally, no account needed.</p>
      </section>
    </main>
  );
}
