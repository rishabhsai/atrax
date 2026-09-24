"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  api,
  appOverviewUrl,
  appStatus,
  audienceLabel,
  errorMessage,
  workspaceUrl,
  type App,
  type Session,
} from "./api";
import { ErrorNotice } from "./ConsoleFrame";
import { CreateWorkspace } from "./CreateWorkspace";
import { ConsoleArtwork } from "./ConsoleArtwork";
import { useSession } from "./useConsole";
import { AgentCommand } from "../../app/components/AgentCommand";
import views from "./workspace-views.module.css";
import styles from "./console.module.css";

function WorkspaceSelection({ session }: { session: Session }) {
  const router = useRouter();
  const [creating, setCreating] = useState(session.workspaces.length === 0);
  return (
    <>
      <header className={views.pageHeader}>
        <div><h1>Workspaces</h1><p>Choose the team you want to work with.</p></div>
        {!creating && <button type="button" className={styles.primary} onClick={() => setCreating(true)}>New workspace</button>}
      </header>
      <div className={views.workspaceLayout}>
        <div>
          {session.invitations.length > 0 && (
            <section className={views.invitations} aria-labelledby="workspace-invitations">
              <div className={views.sectionHeading}><h2 id="workspace-invitations">You’re invited</h2><span className={views.count}>{session.invitations.length}</span></div>
              <ul className={views.workspaceList}>
                {session.invitations.map((invitation) => (
                  <li key={invitation.id}><Link className={views.workspaceLink} href={`/auth/invite/?id=${encodeURIComponent(invitation.id)}`}>
                    <span className={views.workspaceIdentity}><strong>{invitation.workspaceName}</strong><small>Join as {invitation.role}</small></span>
                    <span className={views.rowLink}>Review invitation <span aria-hidden="true">→</span></span>
                  </Link></li>
                ))}
              </ul>
            </section>
          )}
          {session.workspaces.length > 0 && (
            <section aria-labelledby="your-workspaces">
              <div className={views.sectionHeading}><h2 id="your-workspaces">Your teams</h2><span className={views.count}>{session.workspaces.length}</span></div>
              <ul className={views.workspaceList}>
                {session.workspaces.map((workspace) => (
                  <li key={workspace.id}><Link href={workspaceUrl(workspace.id)} className={views.workspaceLink}>
                    <span className={views.workspaceMark} aria-hidden="true">{workspace.name.slice(0, 1).toUpperCase()}</span>
                    <span className={views.workspaceIdentity}><strong>{workspace.name}</strong><small>{workspace.slug}</small></span>
                    <span className={views.workspaceRole}>{workspace.role}</span><span aria-hidden="true">→</span>
                  </Link></li>
                ))}
              </ul>
            </section>
          )}
          {creating && <div className={views.createArea}>
            <CreateWorkspace onCreated={(workspace) => router.push(workspaceUrl(workspace.id))} />
            {session.workspaces.length > 0 && <button type="button" className={styles.textButton} onClick={() => setCreating(false)}>Cancel</button>}
          </div>}
        </div>
        <aside className={views.workspaceAside}>
          <ConsoleArtwork kind="workspace" />
          <h2>A place for your team’s work</h2>
          <p>Each workspace keeps its apps, company knowledge, and people together.</p>
        </aside>
      </div>
    </>
  );
}

function CreateAppGuide({ workspaceName, workspaceSlug }: { workspaceName: string; workspaceSlug: string }) {
  return (
    <section className={views.createAppGuide} aria-labelledby="create-app-heading">
      <div className={views.guideIntroduction}>
        <h2 id="create-app-heading">Your next app starts with an idea.</h2>
        <p>Describe what your business needs to Codex, Claude Code, or Cursor. Your agent builds the app; Atrax runs it for your team.</p>
        <Link href="/docs/quickstart/" className={views.rowLink}>Read the quickstart <span aria-hidden="true">↗</span></Link>
      </div>
      <div className={views.guideSteps}>
        <h3><span>1</span> Connect your agent</h3>
        <p>Run the setup command in your terminal, or copy the prompt into your agent.</p>
        <AgentCommand />
        <h3><span>2</span> Build, test, and deploy</h3>
        <p>Ask your agent to build your app and deploy it to <strong>{workspaceName}</strong> (<code>{workspaceSlug}</code>). It will appear here after deployment.</p>
      </div>
    </section>
  );
}

type AppsState =
  | { kind: "loading" }
  | { kind: "ready"; apps: App[] }
  | { kind: "error"; message: string };

function AppDirectory({ workspaceId, onCreate }: { workspaceId: string; onCreate: () => void }) {
  const params = useSearchParams();
  const [state, setState] = useState<AppsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const query = params.get("q") || "";
  const [filter, setFilter] = useState<"all" | "maintain">("all");
  function updateQuery(value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    const controller = new AbortController();
    api.listApps(workspaceId, controller.signal).then(
      (apps) => setState({ kind: "ready", apps }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [workspaceId, attempt]);
  if (state.kind === "loading")
    return (
      <>
        <div className={styles.skeleton} aria-hidden="true" />
        <p role="status">Loading apps…</p>
      </>
    );
  if (state.kind === "error")
    return (
      <>
        <ErrorNotice message={state.message} />
        <div className={styles.inlineNote}>
          <button
            className={styles.secondary}
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      </>
    );
  if (state.apps.length === 0)
    return (
      <section className={views.emptyDirectory}>
        <span className={views.emptyAppIcon} aria-hidden="true">＋</span>
        <h2>Your apps will live here</h2>
        <p>Build and deploy your first app with your agent, then open it here to get to work.</p>
        <button type="button" className={styles.primary} onClick={onCreate}>Create your first app</button>
      </section>
    );
  const visible = state.apps
    .filter((app) => `${app.name} ${app.slug}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "all" || app.canMaintain))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return (
    <section aria-label="App directory" className={views.directory}>
      <div className={views.directoryToolbar}>
        <div className={views.filters} role="group" aria-label="Filter apps">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All apps <span>{state.apps.length}</span></button>
          <button type="button" aria-pressed={filter === "maintain"} onClick={() => setFilter("maintain")}>Apps I manage</button>
        </div>
        <div className={views.searchField}>
          <label htmlFor="app-search" className={views.visuallyHidden}>Find an app</label>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input id="app-search" type="search" placeholder="Find an app…" value={query} onChange={(event) => updateQuery(event.target.value)} />
        </div>
      </div>
      <div className={views.catalogHeading} aria-hidden="true"><span>App</span><span>Access</span><span>Status</span><span /></div>
      {visible.length ? (
        <ul className={views.appList}>
          {visible.map((app) => (
            <li key={app.id} className={views.appRow}>
              <div className={views.appIdentity}>
                <span className={views.appMark} aria-hidden="true">{app.name.slice(0, 1).toUpperCase()}</span>
                <div><Link href={appOverviewUrl(app.id)} className={views.appName}>{app.name}</Link><small>{app.slug}</small></div>
              </div>
              <div className={views.appAccess}><span>{audienceLabel(app.audience)}</span><small>{app.canMaintain ? "You maintain this app" : !app.canOpen && app.canManageMaintainers ? "Settings access only" : ""}</small></div>
              <span className={views.appStatus} data-status={app.status}><span aria-hidden="true" />{appStatus(app.status)}</span>
              <div className={views.appActions}>
                {(app.canMaintain || app.canManageMaintainers) && <Link className={styles.textButton} href={appOverviewUrl(app.id)} aria-label={`Manage ${app.name}`}>Manage</Link>}
                {app.canOpen && app.activeReleaseId && app.status !== "deleted" && <a className={styles.secondary} href={app.url} aria-label={`Open ${app.name}`}>Open app <span aria-hidden="true">↗</span></a>}
                {!app.activeReleaseId && !app.canMaintain && !app.canManageMaintainers && <Link className={styles.textButton} href={appOverviewUrl(app.id)}>View details</Link>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={views.noResults}>
          <h2>{query ? `No apps match “${query}”` : "You don’t maintain any apps yet"}</h2>
          <p>{query ? "Try another name or clear your filters." : "Apps you create or help maintain will appear here."}</p>
          <button className={styles.secondary} onClick={() => { updateQuery(""); setFilter("all"); }}>Show all apps</button>
        </div>
      )}
      <p className={views.directoryFootnote} role="status">{visible.length} {visible.length === 1 ? "app" : "apps"}{query || filter !== "all" ? ` of ${state.apps.length}` : ""} · Only apps you have access to are shown.</p>
    </section>
  );
}

export function WorkspaceConsole({ showApps = false }: { showApps?: boolean }) {
  const { state } = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const createGuide = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  const requestedWorkspace = params.get("workspace");
  if (state.kind !== "ready") return null;
  const session = state.session;
  if (!showApps || !requestedWorkspace)
    return <WorkspaceSelection session={session} />;
  const workspace = session.workspaces.find(
    (item) => item.id === requestedWorkspace,
  );
  if (!workspace)
    return (
      <>
        <h1>Workspace unavailable</h1>
        <p className={styles.muted}>
          This workspace isn&apos;t available to you.
        </p>
        <Link className={styles.primary} href="/workspaces/">
          Choose a workspace
        </Link>
      </>
    );
  return (
    <>
      <header className={views.pageHeader}>
        <div><h1>Apps</h1><p>Your team’s tools, ready for work.</p></div>
        <button type="button" className={styles.primary} aria-expanded={showCreate} aria-controls="create-app-guide" onClick={() => setShowCreate((open) => !open)}>{showCreate ? "Close setup" : "Create an app"}</button>
      </header>
      {showCreate && <div id="create-app-guide" ref={createGuide} tabIndex={-1} aria-label="Create an app"><CreateAppGuide workspaceName={workspace.name} workspaceSlug={workspace.slug} /></div>}
      <AppDirectory key={workspace.id} workspaceId={workspace.id} onCreate={() => { setShowCreate(true); requestAnimationFrame(() => createGuide.current?.focus()); }} />
    </>
  );
}
