import Link from "next/link";

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
          <Link href="/products">Products</Link>
          <Link href="/solutions">Use cases</Link>
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
            <Link href="/solutions">Use cases</Link>
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
