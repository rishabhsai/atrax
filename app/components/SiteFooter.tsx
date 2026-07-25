import Link from "next/link";
import { productOrder, products } from "../lib/content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-statement">
          <Link className="brand brand-footer" href="/">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>tarantula</span>
          </Link>
          <p>A cloud for everyone.</p>
          <code>tarantula deploy --json</code>
        </div>

        <div className="footer-columns">
          <div>
            <p>Products</p>
            {productOrder.map((slug) => (
              <Link href={`/products/${slug}`} key={slug}>
                {products[slug].name}
                <small>{products[slug].availability}</small>
              </Link>
            ))}
          </div>
          <div>
            <p>Build</p>
            <Link href="/docs">Quickstart</Link>
            <Link href="/docs/cli">CLI reference</Link>
            <Link href="/docs/chat-example">Chat example</Link>
            <Link href="/developers">Agent workflow</Link>
          </div>
          <div>
            <p>Project</p>
            <Link href="/company">Company</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/security">Security</Link>
            <a href="https://github.com/rishabhsai/tarantula">GitHub ↗</a>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Tarantula</span>
        <span>Launchpad and Tables are available. Four products are planned.</span>
      </div>
    </footer>
  );
}
