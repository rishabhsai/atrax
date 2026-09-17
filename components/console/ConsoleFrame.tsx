"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { Session, Workspace } from "./api";
import styles from "./console.module.css";

type ActiveDestination = "apps" | "library" | "team";

function WorkspaceLinks({
  session,
  workspace,
  active,
  onNavigate,
}: {
  session: Session;
  workspace?: Workspace;
  active: ActiveDestination;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className={styles.workspaceLabel}>
        {workspace?.name || "Your workspaces"}
      </div>
      {workspace && session.workspaces.length > 1 && (
        <Link className={styles.smallLink} href="/workspaces/" onClick={onNavigate}>
          Switch workspace
        </Link>
      )}
      <nav className={styles.workspaceNav} aria-label="Workspace">
        <Link
          href={
            workspace
              ? `/workspace/?workspace=${encodeURIComponent(workspace.id)}`
              : "/workspaces/"
          }
          aria-current={active === "apps" ? "page" : undefined}
          className={active === "apps" ? styles.navActive : undefined}
          onClick={onNavigate}
        >
          {workspace ? "Apps" : "Workspaces"}
        </Link>
        {workspace && (
          <Link
            href={`/workspace/library/?workspace=${encodeURIComponent(workspace.id)}`}
            aria-current={active === "library" ? "page" : undefined}
            className={active === "library" ? styles.navActive : undefined}
            onClick={onNavigate}
          >
            Library
          </Link>
        )}
        {workspace && (
          <Link
            href={`/workspace/team/?workspace=${encodeURIComponent(workspace.id)}`}
            aria-current={active === "team" ? "page" : undefined}
            className={active === "team" ? styles.navActive : undefined}
            onClick={onNavigate}
          >
            Team
          </Link>
        )}
      </nav>
      <div className={styles.identity}>
        <span>{session.person.email}</span>
        {workspace && <span className={styles.role}>{workspace.role}</span>}
        <Link href="/auth/device/" onClick={onNavigate}>Connect a CLI</Link>
        <Link href="/docs/quickstart/" onClick={onNavigate}>Documentation</Link>
      </div>
    </>
  );
}

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className={`${styles.console} ${styles.authPage}`}>
      <Link href="/" className={styles.brand}>
        <span aria-hidden="true">A</span> atrax
      </Link>
      <section className={styles.authPanel}>{children}</section>
      <p className={styles.authFooter}>
        <Link href="/docs/quickstart/">Help getting started</Link>
      </p>
    </main>
  );
}

export function ConsoleFrame({
  session,
  workspace,
  children,
  active = "apps",
}: {
  active?: ActiveDestination;
  session: Session;
  workspace?: Workspace;
  children: ReactNode;
}) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const closeAtDesktop = () => {
      if (!mobile.matches && drawerRef.current?.open) drawerRef.current.close();
    };
    mobile.addEventListener("change", closeAtDesktop);
    return () => mobile.removeEventListener("change", closeAtDesktop);
  }, []);

  function openMenu() {
    drawerRef.current?.showModal();
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }

  function closeMenu() {
    drawerRef.current?.close();
  }

  return (
    <div className={`${styles.console} ${styles.workspacePage}`}>
      <a href="#workspace-content" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.mobileBar}>
        <Link href="/workspaces/" className={styles.brand}>
          <span aria-hidden="true">A</span> atrax
        </Link>
        <button ref={menuButtonRef} className={styles.menuButton} type="button" onClick={openMenu}>
          Menu
        </button>
      </header>
      <aside className={styles.sidebar}>
        <Link href="/workspaces/" className={styles.brand}>
          <span aria-hidden="true">A</span> atrax
        </Link>
        <WorkspaceLinks session={session} workspace={workspace} active={active} />
      </aside>
      <dialog
        ref={drawerRef}
        className={styles.mobileDrawer}
        aria-label="Workspace menu"
        onClose={() => menuButtonRef.current?.focus()}
      >
        <div className={styles.drawerHeader}>
          <Link href="/workspaces/" className={styles.brand} onClick={closeMenu}>
            <span aria-hidden="true">A</span> atrax
          </Link>
          <button ref={closeButtonRef} className={styles.menuButton} type="button" onClick={closeMenu}>
            Close
          </button>
        </div>
        <WorkspaceLinks session={session} workspace={workspace} active={active} onNavigate={closeMenu} />
      </dialog>
      <main id="workspace-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}

export function LoadingPanel() {
  return (
    <AuthFrame>
      <h1>Opening your workspace</h1>
      <div className={styles.skeleton} aria-hidden="true" />
      <p role="status">Checking your session…</p>
    </AuthFrame>
  );
}
