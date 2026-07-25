import Link from "next/link";
import { products } from "../lib/content";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Tarantula home">
          <span className="brand-mark" aria-hidden="true">t</span>
          <span>tarantula</span>
          <small>alpha</small>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <div className="nav-cluster">
            <Link href="/products">Products <span aria-hidden="true">⌄</span></Link>
            <div className="mega-menu product-menu">
              <div className="mega-intro">
                <span className="mega-kicker">A complete small cloud</span>
                <p>Every primitive an agent needs to ship a real app.</p>
                <Link href="/products">Explore all products →</Link>
              </div>
              <div className="mega-links">
                {Object.values(products).map((product) => (
                  <Link href={`/products/${product.slug}`} key={product.slug}>
                    <span>{product.name}</span>
                    <small>{product.eyebrow}</small>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/solutions">What to build</Link>
          <Link href="/developers">Developers</Link>
          <Link href="/security">Security</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>

        <div className="nav-actions">
          <Link className="nav-plain" href="/company">About</Link>
          <Link className="nav-cta" href="/company">
            Join alpha <span aria-hidden="true">→</span>
          </Link>
        </div>

        <details className="mobile-nav">
          <summary>Menu</summary>
          <div className="mobile-panel">
            <Link href="/products">Products</Link>
            {Object.values(products).map((product) => (
              <Link href={`/products/${product.slug}`} key={product.slug}>
                <span>↳</span> {product.name}
              </Link>
            ))}
            <Link href="/solutions">What to build</Link>
            <Link href="/developers">Developers</Link>
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/company">Join alpha</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
