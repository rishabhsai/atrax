import Link from "next/link";
import { productOrder, products, solutions } from "../lib/content";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Tarantula home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>tarantula</span>
          <small>v0</small>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <details className="nav-menu nav-menu-products">
            <summary>Products <span aria-hidden="true">⌄</span></summary>
            <div className="nav-menu-panel">
              <Link className="nav-menu-overview" href="/products">
                <strong>All products</strong>
                <small>Six clear system boundaries →</small>
              </Link>
              <div className="nav-menu-grid">
                {productOrder.map((slug) => (
                  <Link href={`/products/${slug}`} key={slug}>
                    <strong>{products[slug].name}</strong>
                    <small>{products[slug].eyebrow}</small>
                    <i>{products[slug].availability}</i>
                  </Link>
                ))}
              </div>
            </div>
          </details>
          <details className="nav-menu nav-menu-use-cases">
            <summary>Use cases <span aria-hidden="true">⌄</span></summary>
            <div className="nav-menu-panel">
              <Link className="nav-menu-overview" href="/solutions">
                <strong>All use cases</strong>
                <small>Start with one useful app →</small>
              </Link>
              <div className="nav-menu-grid">
                {Object.values(solutions).map((useCase) => (
                  <Link href={`/solutions/${useCase.slug}`} key={useCase.slug}>
                    <strong>{useCase.name}</strong>
                    <small>{useCase.short}</small>
                  </Link>
                ))}
              </div>
            </div>
          </details>
          <Link href="/docs">Docs</Link>
          <Link href="/developers">CLI</Link>
          <Link href="/security">Security</Link>
        </nav>

        <details className="mobile-nav">
          <summary>Menu</summary>
          <div className="mobile-panel">
            <Link href="/products">Products</Link>
            <Link href="/solutions">Use cases</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/developers">CLI</Link>
            <Link href="/security">Security</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
