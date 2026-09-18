"use client";

import Link from "next/link";
import { useRef } from "react";
import styles from "./SiteChrome.module.css";

const links = [
  { href: "/#products", label: "Product", arrow: "↓" },
  { href: "/docs/", label: "Docs" },
  { href: "/agents.md", label: "For agents" },
  { href: "/workspaces/", label: "Workspaces" },
];

export function SiteHeader() {
  const menu = useRef<HTMLDetailsElement>(null);
  function closeMenu() {
    if (menu.current) menu.current.open = false;
  }

  return (
    <header className={styles.header}>
      <div className={styles["header-inner"]}>
        <Link className={styles.brand} href="/" aria-label="Atrax home">
          <span aria-hidden="true">A</span>atrax
        </Link>
        <nav className={styles["desktop-nav"]} aria-label="Primary navigation">
          {links.map(({ href, label, arrow }) => (
            <a
              key={href}
              href={href}
              className={label === "Workspaces" ? styles.workspace : undefined}
            >
              {label}
              {arrow && <span aria-hidden="true">{arrow}</span>}
            </a>
          ))}
        </nav>
        <details
          className={styles["mobile-nav"]}
          ref={menu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeMenu();
              menu.current?.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Menu <span aria-hidden="true">+</span>
          </summary>
          <nav aria-label="Mobile navigation" onClick={closeMenu}>
            {links.map(({ href, label }) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
