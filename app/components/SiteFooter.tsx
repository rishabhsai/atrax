import Link from "next/link";
import styles from "./SiteChrome.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles["footer-inner"]}>
        <div className={styles["footer-main"]}>
          <Link className={styles.brand} href="/">
            atrax
          </Link>
          <p>A cloud for everyone.</p>
          <nav aria-label="Footer">
            <Link href="/pricing/">Pricing</Link>
            <Link href="/security/">Security</Link>
            <Link href="/docs/mcp/">MCP</Link>
            <Link href="/developers/">CLI</Link>
            <a href="https://github.com/rishabhsai/atrax">GitHub ↗</a>
          </nav>
        </div>
        <div className={styles["footer-note"]}>
          <span>© 2026 Atrax</span>
          <span>
            Planned: <Link href="/docs/automation/">scheduled automation</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
