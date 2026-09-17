import Link from "next/link";
import { availableProductOrder, products } from "../lib/content";

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
            {availableProductOrder.map((slug) => (
              <Link href={`/products/${slug}`} key={slug}>
                {products[slug].name}
                <small>{products[slug].availability}</small>
              </Link>
            ))}
          </div>
          <div>
            <p>For agents</p>
            <Link href="/products/mcp">MCP</Link>
            <Link href="/docs/quickstart">Quickstart</Link>
            <Link href="/docs/cli">CLI reference</Link>
            <Link href="/docs/inventory-orders">Connected apps</Link>
            <a href="/agents.md">Agent guide</a>
          </div>
          <div>
            <p>Atrax</p>
            <Link href="/company">About Atrax</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/security">Security</Link>
            <Link href="/products/automation">Automation <small>planned</small></Link>
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
