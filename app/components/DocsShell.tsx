import Link from "next/link";
import { docOrder, docs, type DocPage } from "../lib/docs";
import styles from "./docs.module.css";

const groups: DocPage["group"][] = ["Start", "Build", "Products", "For agents", "Operate", "Planned"];
const statusLabels = { available: "Available", planned: "Upcoming", mixed: "Availability varies" };
const docUrl = (slug: string) => slug === "quickstart" ? "/docs" : `/docs/${slug}`;
const sectionId = (heading: string) => heading.toLowerCase().replaceAll(" ", "-");

function DocsDirectory({ currentSlug }: { currentSlug: string }) {
  return (
    <>
      <nav aria-label="Documentation" className={styles.directory}>
        {groups.map((group) => (
          <div key={group}>
            <p>{group}</p>
            {docOrder.map((slug) => docs[slug]).filter((item) => item.group === group).map((item) => (
              <Link aria-current={item.slug === currentSlug ? "page" : undefined} href={docUrl(item.slug)} key={item.slug}>
                {item.title}
                {item.status === "planned" ? <small>Upcoming</small> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className={styles.machineLinks}>
        <p>For your agent</p>
        <a href="/agents.md">agents.md ↗</a>
        <a href="/docs.json">docs.json ↗</a>
        <a href="/llms.txt">llms.txt ↗</a>
        <a href="/llms-full.txt">llms-full.txt ↗</a>
      </div>
    </>
  );
}

export function DocsShell({ doc }: { doc: DocPage }) {
  const index = docOrder.findIndex((slug) => slug === doc.slug);
  const previous = index > 0 ? docs[docOrder[index - 1]] : undefined;
  const next = index >= 0 && index < docOrder.length - 1 ? docs[docOrder[index + 1]] : undefined;
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <Link className={styles.wordmark} href="/docs">Atrax docs</Link>
          <div className={styles.desktopDirectory}><DocsDirectory currentSlug={doc.slug} /></div>
          <details className={styles.mobileDirectory}>
            <summary>Browse documentation</summary>
            <DocsDirectory currentSlug={doc.slug} />
          </details>
        </aside>
        <article className={styles.article}>
          <header className={styles.header}>
            <div className={styles.meta}><span>{doc.group}</span><span>{statusLabels[doc.status]}</span></div>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
            <a href={`/docs/${doc.slug}/index.md`}>Read as Markdown ↗</a>
          </header>
          <nav aria-label="On this page" className={styles.contents}>
            <p>On this page</p>
            <ol>{doc.sections.map((section) => <li key={section.heading}><a href={`#${sectionId(section.heading)}`}>{section.heading}</a></li>)}</ol>
          </nav>
          {doc.sections.map((section) => (
            <section id={sectionId(section.heading)} className={styles.section} key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
              {section.code ? <pre tabIndex={0} aria-label={`${section.heading} example`}><code>{section.code}</code></pre> : null}
              {section.note ? <aside>{section.note}</aside> : null}
            </section>
          ))}
          <nav className={styles.pagination} aria-label="Adjacent guides">
            {previous ? <Link href={docUrl(previous.slug)}><small>← Previous guide</small>{previous.title}</Link> : <span />}
            {next ? <Link href={docUrl(next.slug)}><small>Next guide →</small>{next.title}</Link> : null}
          </nav>
          <footer className={styles.footer}><span>Found a docs issue?</span><a href="https://github.com/rishabhsai/atrax/issues">Open GitHub ↗</a></footer>
        </article>
      </div>
    </main>
  );
}
