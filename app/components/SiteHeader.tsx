"use client";

import Link from "next/link";
import { useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { solutions } from "../lib/content";

type NavMenuProps = {
  className: string;
  label: string;
  children: ReactNode;
};

function NavMenu({ className, label, children }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      event.currentTarget.querySelector("button")?.focus();
    }
  }

  return (
    <div
      className={`nav-menu ${className}${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onBlurCapture={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {label} <span aria-hidden="true">⌄</span>
      </button>
      <div id={panelId}>{children}</div>
    </div>
  );
}

export function SiteHeader() {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Link className="brand" href="/" aria-label="Atrax home">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>atrax</span>
          <small>v0</small>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/#products">Products</Link>
          <NavMenu className="nav-menu-use-cases" label="Use cases">
            <div className="nav-menu-panel">
              <Link className="nav-menu-overview" href="/solutions">
                <strong>All use cases</strong>
                <small>Start with one useful app →</small>
              </Link>
              <div className="nav-menu-grid">
                {Object.values(solutions).map((useCase) => (
                  <Link href={`/solutions/${useCase.slug}`} key={useCase.slug}>
                    <strong>{useCase.name}</strong>
                    <small>{useCase.short}</small>
                  </Link>
                ))}
              </div>
            </div>
          </NavMenu>
          <Link href="/docs">Docs</Link>
          <Link href="/developers">CLI</Link>
          <Link href="/security">Security</Link>
          <Link className="nav-account" href="/account">Account</Link>
        </nav>

        <details className="mobile-nav" ref={mobileMenu}>
          <summary>Menu</summary>
          <div className="mobile-panel">
            <Link href="/#products" onClick={() => { if (mobileMenu.current) mobileMenu.current.open = false; }}>Products</Link>
            <Link href="/solutions">Use cases</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/developers">CLI</Link>
            <Link href="/security">Security</Link>
            <Link href="/account">Account</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
