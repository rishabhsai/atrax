import Link from "next/link";
import { docOrder, docs, type DocPage } from "../lib/docs";

const groups: DocPage["group"][] = ["Start", "Build", "Products", "For agents", "Operate", "Planned"];

function DocsDirectory({ currentSlug }: { currentSlug: string }) {
  return (
    <>
      <nav aria-label="Documentation">
        {groups.map((group) => (
          <div key={group}>
            <p>{group}</p>
            {docOrder
              .map((slug) => docs[slug])
              .filter((item) => item.group === group)
              .map((item) => (
                <Link
                  aria-current={item.slug === currentSlug ? "page" : undefined}
                  href={
                    item.slug === "quickstart" ? "/docs" : `/docs/${item.slug}`
                  }
                  key={item.slug}
                >
                  {item.title}
                  <i className={`status-dot status-dot-${item.status}`} />
                </Link>
              ))}
          </div>
        ))}
      </nav>
      <div className="docs-machine-links">
        <a href="/agents.md">agents.md ↗</a>
        <a href="/docs.json">docs.json ↗</a>
        <a href="/llms.txt">llms.txt ↗</a>
        <a href="/llms-full.txt">llms-full.txt ↗</a>
      </div>
    </>
  );
}

export function DocsShell({ doc }: { doc: DocPage }) {
  return (
    <main className="docs-page">
      <div className="shell docs-layout">
        <aside className="docs-sidebar">
          <Link className="docs-wordmark" href="/docs">Atrax docs</Link>
          <div className="docs-directory-desktop">
            <DocsDirectory currentSlug={doc.slug} />
          </div>
          <details className="docs-directory-mobile">
            <summary>Browse documentation</summary>
            <DocsDirectory currentSlug={doc.slug} />
          </details>
        </aside>

        <article className="docs-article">
          <header>
            <div>
              <span className={`status status-${doc.status}`}>{doc.status}</span>
              <span>{doc.group}</span>
            </div>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
            <a href={`/docs/${doc.slug}/index.md`}>Read as Markdown ↗</a>
          </header>

          {doc.sections.map((section) => (
            <section id={section.heading.toLowerCase().replaceAll(" ", "-")} key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
              {section.code ? <pre><code>{section.code}</code></pre> : null}
              {section.note ? <aside>{section.note}</aside> : null}
            </section>
          ))}

          <footer>
            <span>Found a docs issue?</span>
            <a href="https://github.com/rishabhsai/atrax">Open GitHub ↗</a>
          </footer>
        </article>
      </div>
    </main>
  );
}
