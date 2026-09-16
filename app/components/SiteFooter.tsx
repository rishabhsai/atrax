import Link from "next/link";
import { productOrder, products } from "../lib/content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div className="footer-statement">
          <Link className="brand brand-footer" href="/">
            <span className="brand-mark" aria-hidden="true">
              A
            </span>
            <span>atrax</span>
          </Link>
          <p>A cloud for everyone.</p>
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
            <Link href="/docs/quickstart">Quickstart</Link>
            <Link href="/docs/cli">CLI reference</Link>
            <Link href="/docs/inventory-orders">Connected apps</Link>
            <a href="/agents.md">Agent guide</a>
          </div>
          <div>
            <p>Project</p>
            <Link href="/company">Company</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/security">Security</Link>
            <a href="https://github.com/rishabhsai/atrax">GitHub ↗</a>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Atrax</span>
        <span>
          Built with your agent. Owned by your company.
        </span>
      </div>
    </footer>
  );
}
