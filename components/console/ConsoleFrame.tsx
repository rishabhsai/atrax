"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { errorMessage, isSignInRequired, operation, workspaceUrl, type Session, type Workspace } from "./api";
import { useSession, useSubmission } from "./useConsole";
import { ConsoleArtwork } from "./ConsoleArtwork";
import styles from "./console.module.css";

export type ActiveDestination = "apps" | "library" | "team" | "secrets";

function NavIcon({ kind }: { kind: ActiveDestination | "workspaces" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "apps" ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> : kind === "library" ? <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z" /><path d="M13 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2" /></> : kind === "secrets" ? <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></> : kind === "team" ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4" /></> : <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" /></>}
  </svg>;
}

function WorkspaceLinks({ session, workspace, active, onNavigate }: { session: Session; workspace?: Workspace; active: ActiveDestination; onNavigate?: () => void }) {
  const router = useRouter();
  const { endSession } = useSession();
  const command = useSubmission();
  const destinations: { id: ActiveDestination; label: string; href: string }[] = [
    { id: "apps", label: "Apps", href: workspace ? workspaceUrl(workspace.id) : "/workspaces/" },
    { id: "library", label: "Library", href: `/workspace/library/?workspace=${encodeURIComponent(workspace?.id ?? "")}` },
    { id: "team", label: "Team", href: `/workspace/team/?workspace=${encodeURIComponent(workspace?.id ?? "")}` },
  ];
  if (workspace && ["owner", "admin"].includes(workspace.role)) destinations.push({ id: "secrets", label: "Secrets", href: `/workspace/secrets/?workspace=${encodeURIComponent(workspace.id)}` });
  async function signOut() {
    const result = await command.run(session.session.id, async (key) => {
      await operation("auth.session.revoke", { sessionId: session.session.id }, (value) => value, { key });
      return true;
    });
    if (result) { endSession(); router.replace("/sign-in/"); }
  }
  return <>
    <div className={styles.workspaceSwitcher}>
      <label>Workspace
        <select value={workspace?.id ?? ""} onChange={(event) => {
          const id = event.target.value;
          router.push(!id ? "/workspaces/" : (active === "apps" || (active === "secrets" && !["owner", "admin"].includes(session.workspaces.find((item) => item.id === id)?.role ?? ""))) ? workspaceUrl(id) : `/workspace/${active}/?workspace=${encodeURIComponent(id)}`);
          onNavigate?.();
        }}>
          <option value="">All workspaces</option>
          {session.workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    <nav className={styles.workspaceNav} aria-label="Workspace">
      {workspace ? destinations.map((item) => <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined} className={active === item.id ? styles.navActive : undefined} onClick={onNavigate}><NavIcon kind={item.id} />{item.label}</Link>) : <Link href="/workspaces/" aria-current="page" className={styles.navActive} onClick={onNavigate}><NavIcon kind="workspaces" />Workspaces</Link>}
    </nav>
    <div className={styles.sidebarHelp}>
      <p>Build with your agent</p>
      <span>Create locally, then deploy into your workspace.</span>
      <Link href="/docs/quickstart/" onClick={onNavigate}>Read the quickstart ↗</Link>
    </div>
    <div className={styles.identity}>
      <div className={styles.identityPerson}><span className={styles.avatar} aria-hidden="true">{session.person.email.slice(0, 1).toUpperCase()}</span><div><strong>{session.person.email}</strong><small>{workspace?.role ?? "Atrax account"}</small></div></div>
      <div className={styles.identityActions}><Link href="/workspaces/" onClick={onNavigate}>All workspaces</Link><button type="button" onClick={signOut} disabled={command.state.kind === "pending"}>{command.state.kind === "pending" ? "Signing out…" : "Sign out"}</button></div>
      {command.state.kind === "error" && <ErrorNotice message={command.state.message} />}
    </div>
  </>;
}

export function AuthFrame({ children }: { children: ReactNode }) {
  return <main className={`${styles.console} ${styles.authPage}`}><Link href="/" className={styles.brand}><span aria-hidden="true">A</span> atrax</Link><div className={styles.authLayout}><ConsoleArtwork kind="entry" /><section className={styles.authPanel}>{children}</section></div><p className={styles.authFooter}><Link href="/docs/quickstart/">Help getting started</Link></p></main>;
}

export function ConsoleFrame({ session, workspace, children, active = "apps" }: { active?: ActiveDestination; session: Session; workspace?: Workspace; children: ReactNode }) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const closeAtDesktop = () => { if (!mobile.matches && drawerRef.current?.open) drawerRef.current.close(); };
    mobile.addEventListener("change", closeAtDesktop);
    return () => mobile.removeEventListener("change", closeAtDesktop);
  }, []);
  const closeMenu = () => drawerRef.current?.close();
  const brand = <Link href="/workspaces/" className={styles.brand}><span aria-hidden="true">A</span> atrax</Link>;
  return <div className={`${styles.console} ${styles.workspacePage}`}>
    <a href="#workspace-content" className={styles.skip}>Skip to content</a>
    <header className={styles.mobileBar}>{brand}<button ref={menuButtonRef} className={styles.menuButton} type="button" onClick={() => { drawerRef.current?.showModal(); requestAnimationFrame(() => closeButtonRef.current?.focus()); }}>Menu</button></header>
    <aside className={styles.sidebar} aria-label="Workspace sidebar">{brand}<WorkspaceLinks session={session} workspace={workspace} active={active} /></aside>
    <dialog ref={drawerRef} className={styles.mobileDrawer} aria-label="Workspace menu" onClose={() => menuButtonRef.current?.focus()}>
      <div className={styles.drawerHeader}>{brand}<button ref={closeButtonRef} className={styles.menuButton} type="button" onClick={closeMenu}>Close</button></div>
      <WorkspaceLinks session={session} workspace={workspace} active={active} onNavigate={closeMenu} />
    </dialog>
    <div className={styles.workspaceBody}>
      <div className={styles.desktopBar}><span>{workspace?.name ?? "Your workspaces"}<span className={styles.barDivider}>/</span>{workspace ? active === "library" ? "Company knowledge" : active === "team" ? "People & access" : active === "secrets" ? "Credentials" : "Apps" : "Overview"}</span><div><Link href="/auth/device/">Connect an agent</Link><Link href="/docs/">Help ↗</Link></div></div>
      <main id="workspace-content" className={styles.main} tabIndex={-1}>{children}</main>
    </div>
  </div>;
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const params = useSearchParams();
  const { state, retry, selectedWorkspaceId, selectWorkspace } = useSession();
  const requestedWorkspace = params.get("workspace");
  const appPage = path.startsWith("/workspace/app");
  const workspaceId = requestedWorkspace ?? (appPage ? selectedWorkspaceId : null);
  const active = path.startsWith("/workspace/library") ? "library" : path.startsWith("/workspace/team") ? "team" : path.startsWith("/workspace/secrets") ? "secrets" : "apps";
  const workspace = state.kind === "ready" ? state.session.workspaces.find((item) => item.id === workspaceId) : undefined;
  useEffect(() => { if (requestedWorkspace) selectWorkspace(requestedWorkspace); }, [requestedWorkspace, selectWorkspace]);
  if (state.kind === "loading") return <ConsoleOpening />;
  if (state.kind === "error") {
    const signIn = isSignInRequired(state.error);
    const returnTo = `${path}${params.size ? `?${params}` : ""}`;
    return <AuthFrame><h1>{signIn ? "Sign in to your workspace" : "Couldn't open your workspace"}</h1>{signIn ? <><p className={styles.muted}>Use your email to return to your apps and team.</p><Link className={styles.primary} href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}>Continue with email</Link></> : <><ErrorNotice message={errorMessage(state.error)} /><button className={styles.secondary} onClick={retry}>Try again</button></>}</AuthFrame>;
  }
  return <ConsoleFrame key={state.session.session.id} session={state.session} workspace={workspace} active={active}>
    {state.refreshError && <div className={styles.refreshNotice} role="status"><span>Couldn&apos;t refresh workspace information. {state.refreshError}</span><button type="button" onClick={retry}>Retry</button></div>}
    {children}
  </ConsoleFrame>;
}

export function ConsoleOpening() {
  return <div className={`${styles.console} ${styles.opening}`}><div className={styles.openingRail}><span className={styles.brand}><span>A</span> atrax</span><div className={styles.skeleton} /><div className={styles.skeleton} /></div><div className={styles.openingBody}><PageLoading label="Checking your session…" /></div></div>;
}
export function PageLoading({ label = "Loading this page…" }: { label?: string }) {
  return <section className={styles.pageLoading} aria-label={label}><div className={styles.skeletonTitle} aria-hidden="true" /><div className={styles.skeleton} aria-hidden="true" /><div className={styles.skeleton} aria-hidden="true" /><p role="status" className={styles.small}>{label}</p></section>;
}
export function ErrorNotice({ message }: { message: string }) { return <p className={styles.error} role="alert">{message}</p>; }
export function LoadingPanel() { return <AuthFrame><h1>Checking your session</h1><PageLoading label="Please wait…" /></AuthFrame>; }
