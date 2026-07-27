"use client";

import Link from "next/link";
import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { productOrder, products, solutions } from "../lib/content";

type NavMenuProps = {
  className: string;
  label: string;
  href: string;
  children: ReactNode;
};

function NavMenu({ className, label, href, children }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      event.currentTarget.querySelector("a")?.focus();
    }
  }

  return (
    <div
      className={`nav-menu ${className}${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <Link href={href} aria-expanded={open} aria-haspopup="true">
        {label} <span aria-hidden="true">⌄</span>
      </Link>
      {children}
    </div>
  );
}

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
          <NavMenu className="nav-menu-products" label="Products" href="/products">
            <div className="nav-menu-panel">
              <Link className="nav-menu-overview" href="/products">
                <strong>All products</strong>
                <small>Six clear system boundaries →</small>
              </Link>
              <div className="nav-menu-grid">
                {productOrder.map((slug) => (
                  <Link href={`/products/${slug}`} key={slug}>
                    <strong>{products[slug].name}</strong>
                    <small>{products[slug].eyebrow}</small>
                    <i>{products[slug].availability}</i>
                  </Link>
                ))}
              </div>
            </div>
          </NavMenu>
          <NavMenu className="nav-menu-use-cases" label="Use cases" href="/solutions">
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

        <details className="mobile-nav">
          <summary>Menu</summary>
          <div className="mobile-panel">
            <Link href="/products">Products</Link>
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
