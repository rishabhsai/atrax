import Link from "next/link";
import { products, solutions } from "../lib/content";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Tarantula home">
          <span className="brand-mark" aria-hidden="true">
            t/
          </span>
          tarantula
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <div className="nav-cluster">
            <Link href="/products">Products</Link>
            <div className="mega-menu product-menu">
              <div className="mega-intro">
                <span className="mega-kicker">Platform</span>
                <p>One runtime for software built and operated by agents.</p>
                <Link href="/products">View platform overview →</Link>
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
          <div className="nav-cluster">
            <Link href="/solutions">Solutions</Link>
            <div className="mega-menu solution-menu">
              <div className="mega-intro">
                <span className="mega-kicker">Use cases</span>
                <p>Operational software for the work between existing tools.</p>
                <Link href="/solutions">Explore all solutions →</Link>
              </div>
              <div className="mega-links">
                {Object.values(solutions).map((solution) => (
                  <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
                    <span>{solution.name}</span>
                    <small>{solution.eyebrow}</small>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/developers">Developers</Link>
          <Link href="/security">Security</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>

        <div className="nav-actions">
          <Link className="signin-link" href="/company">
            Sign in
          </Link>
          <Link className="nav-cta" href="/company">
            Join alpha <span aria-hidden="true">↗</span>
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
            <Link href="/solutions">Solutions</Link>
            {Object.values(solutions).map((solution) => (
              <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
                <span>↳</span> {solution.name}
              </Link>
            ))}
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
