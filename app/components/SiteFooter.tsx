import Link from "next/link";
import { products } from "../lib/content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-top">
        <div className="footer-brand">
          <Link className="brand brand-light" href="/">
            <span className="brand-mark" aria-hidden="true">t</span>
            <span>tarantula</span>
          </Link>
          <p>A cloud for small software.</p>
          <code>npx tarantula new</code>
        </div>
        <div className="footer-links">
          <div>
            <p>Cloud</p>
            {Object.values(products).map((product) => (
              <Link href={`/products/${product.slug}`} key={product.slug}>
                {product.name}
              </Link>
            ))}
          </div>
          <div>
            <p>Explore</p>
            <Link href="/solutions">What to build</Link>
            <Link href="/developers">Developers</Link>
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div>
            <p>Company</p>
            <Link href="/company">About</Link>
            <Link href="/company">Private alpha</Link>
            <a href="https://github.com/rishabhsai/tarantula">GitHub</a>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Tarantula Systems</span>
        <div>
          <Link href="/security">Privacy</Link>
          <Link href="/security">Terms</Link>
          <span className="system-state"><i /> All systems operational</span>
        </div>
      </div>
    </footer>
  );
}
