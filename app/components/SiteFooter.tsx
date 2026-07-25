import Link from "next/link";
import { products, solutions } from "../lib/content";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-top">
        <div className="footer-brand">
          <Link className="brand brand-light" href="/">
            <span className="brand-mark" aria-hidden="true">
              t/
            </span>
            tarantula
          </Link>
          <p>Software that keeps working.</p>
        </div>
        <div className="footer-links">
          <div>
            <p>Products</p>
            {Object.values(products).map((product) => (
              <Link href={`/products/${product.slug}`} key={product.slug}>
                {product.name}
              </Link>
            ))}
          </div>
          <div>
            <p>Solutions</p>
            {Object.values(solutions).map((solution) => (
              <Link href={`/solutions/${solution.slug}`} key={solution.slug}>
                {solution.name}
              </Link>
            ))}
          </div>
          <div>
            <p>Resources</p>
            <Link href="/developers">Developers</Link>
            <Link href="/security">Security</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div>
            <p>Company</p>
            <Link href="/company">About</Link>
            <Link href="/company">Contact</Link>
            <Link href="/company">Private alpha</Link>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Tarantula Systems, Inc.</span>
        <div>
          <Link href="/security">Privacy</Link>
          <Link href="/security">Terms</Link>
          <span className="system-state">
            <i /> All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}
