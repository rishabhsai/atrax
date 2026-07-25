import Link from "next/link";

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
          <Link href="/products">Products</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/developers">CLI</Link>
          <Link href="/solutions">Examples</Link>
          <Link href="/security">Security</Link>
        </nav>

        <div className="nav-actions">
          <a
            className="nav-github"
            href="https://github.com/rishabhsai/tarantula"
          >
            GitHub
          </a>
          <a
            className="nav-cta"
            href="https://tarantula-chat-demo.rishabhsai-mdbar.workers.dev"
          >
            Open live chat <span aria-hidden="true">↗</span>
          </a>
        </div>

        <details className="mobile-nav">
          <summary>Menu</summary>
          <div className="mobile-panel">
            <Link href="/products">Products</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/developers">CLI</Link>
            <Link href="/solutions">Examples</Link>
            <Link href="/security">Security</Link>
            <a href="https://tarantula-chat-demo.rishabhsai-mdbar.workers.dev">
              Open live chat ↗
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}
