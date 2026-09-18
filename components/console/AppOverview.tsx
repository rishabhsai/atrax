"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  appOverviewUrl,
  appStatus,
  audienceLabel,
  errorMessage,
  workspaceUrl,
  type AppDetails,
  type Session,
} from "./api";
import { ErrorNotice, PageLoading } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import { ExternalSharingPanel } from "./ExternalSharingPanel";
import { AppOperations } from "./AppOperations";
import { SharingPanel } from "./SharingPanel";
import styles from "./console.module.css";
import views from "./app-views.module.css";

type AppState =
  | { kind: "loading" }
  | { kind: "ready"; detail: AppDetails; refreshError?: string }
  | { kind: "error"; message: string };

type AppView = "overview" | "operations" | "access" | "sharing";
const sections: { id: AppView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "access", label: "Access" },
  { id: "sharing", label: "Sharing" },
];

function AppContent({ appId, session, view }: { appId: string; session: Session; view: AppView }) {
  const { selectWorkspace } = useSession();
  const [state, setState] = useState<AppState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const reloadApp = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    api.getApp(appId, controller.signal).then(
      (detail) => {
        if (!controller.signal.aborted) setState({ kind: "ready", detail });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = errorMessage(error);
        setState((current) => current.kind === "ready"
          ? { ...current, refreshError: message }
          : { kind: "error", message });
      },
    );
    return () => controller.abort();
  }, [appId, attempt]);

  const workspaceId = state.kind === "ready" ? state.detail.app.workspaceId : null;
  useEffect(() => {
    if (workspaceId) selectWorkspace(workspaceId);
  }, [workspaceId, selectWorkspace]);

  if (state.kind === "loading") return <PageLoading label="Loading app details…" />;
  if (state.kind === "error") return (
    <section>
      <h1>Couldn&apos;t open this app</h1>
      <ErrorNotice message={state.message} />
      <div className={`${styles.actions} ${styles.inlineNote}`}>
        <button className={styles.secondary} onClick={() => {
          setState({ kind: "loading" });
          setAttempt((value) => value + 1);
        }}>Try again</button>
        <Link href="/workspaces/">Your workspaces</Link>
      </div>
    </section>
  );

  const { app, capabilities, release } = state.detail;
  const workspace = session.workspaces.find((item) => item.id === app.workspaceId);
  const activeView = view === "operations" && !capabilities.maintain ? "overview" : view;
  const canShare = workspace?.role === "owner" || workspace?.role === "admin";
  const canOpen = capabilities.canOpen && app.activeReleaseId && app.status !== "deleted";

  return (
    <div className={views.app}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href={workspaceUrl(app.workspaceId)}>Apps</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{app.name}</span>
      </nav>
      <header className={views.header}>
        <div>
          <div className={views.titleRow}>
            <h1>{app.name}</h1>
            <span className={styles.status}>{appStatus(app.status)}</span>
          </div>
          <p className={views.address}>
            {canOpen ? <a href={app.url}>{app.url}</a> : app.status === "deleted"
              ? "This app has been deleted."
              : app.activeReleaseId
                ? "This app is not shared with you."
                : "Deploy this app to make it available to your team."}
          </p>
        </div>
        {canOpen && <a className={styles.primary} href={app.url}>Open app <span aria-hidden="true">↗</span></a>}
      </header>
      <nav className={views.navigation} aria-label="App sections">
        {sections.filter((section) => section.id !== "operations" || capabilities.maintain).map((section) => <Link
          key={section.id}
          href={`${appOverviewUrl(app.id)}&view=${section.id}`}
          scroll={false}
          aria-current={activeView === section.id ? "page" : undefined}
        >{section.label}</Link>)}
      </nav>
      {state.refreshError && <div className={views.refreshError}>
        <ErrorNotice message={`Couldn't refresh app details. ${state.refreshError}`} />
        <button type="button" className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      </div>}

      <div hidden={activeView !== "overview"}>
        <dl className={views.summary}>
          <div><dt>App access</dt><dd>{audienceLabel(app.audience)}</dd></div>
          <div><dt>Workspace</dt><dd>{workspace?.name ?? "Workspace"}</dd></div>
          <div><dt>Your permissions</dt><dd>{capabilities.maintain
            ? "Maintain and deploy"
            : capabilities.canManageMaintainers
              ? "Manage maintainers"
              : capabilities.canOpen ? "Use this app" : "No app access"}</dd></div>
        </dl>
        {capabilities.maintain && <section className={views.section} aria-labelledby="current-release-heading">
          <div className={views.sectionHeader}>
            <div><h2 id="current-release-heading">Current release</h2><p>Deploy updates from your project with the Atrax CLI.</p></div>
            <Link href="/docs/quickstart/">Deployment guide <span aria-hidden="true">↗</span></Link>
          </div>
          {release ? <dl className={views.release}>
            <div><dt>Release</dt><dd><code>{release.id}</code></dd></div>
            <div><dt>Created</dt><dd><time dateTime={new Date(release.createdAt).toISOString()}>{new Date(release.createdAt).toLocaleString()}</time></dd></div>
            <div className={views.artifact}><dt>Artifact hash</dt><dd><code>{release.hash}</code></dd></div>
          </dl> : <div className={views.empty}><h3>Your first release starts in your project</h3><p>Deploy with the Atrax CLI to give this app a live URL.</p></div>}
        </section>}
        {capabilities.canOpen && release && <section className={views.section} aria-labelledby="app-actions-heading">
          <div className={views.sectionHeader}>
            <div><h2 id="app-actions-heading">App actions <span className={views.count}>{release.actions.length}</span></h2><p>Named operations published by the current release.</p></div>
            {capabilities.manageAccess && <Link href={`${appOverviewUrl(app.id)}&view=access`} scroll={false}>Manage action access</Link>}
          </div>
          {release.actions.length ? <ul className={views.actionList}>
            {release.actions.map((action) => <li key={action.name}>
              <code>{action.name}</code><p>{action.description}</p>
            </li>)}
          </ul> : <p className={views.empty}>This release does not expose any named actions.</p>}
        </section>}
      </div>

      {capabilities.maintain && <div hidden={activeView !== "operations"}><AppOperations appId={app.id} appStatus={app.status} activeReleaseId={app.activeReleaseId} onAppChanged={reloadApp} /></div>}

      {/* Keep drafts mounted while the URL selects the visible section. */}
      <div hidden={activeView !== "access"} className={views.panel}>
        {capabilities.canManageMaintainers ? <SharingPanel
          appId={app.id}
          workspaceId={app.workspaceId}
          actionNames={release?.actions.map((action) => action.name) ?? []}
          canManageAccess={capabilities.manageAccess}
          canManageMaintainers={capabilities.canManageMaintainers}
          onAppAccessSaved={(audience) => setState((current) => current.kind === "ready"
            ? { ...current, detail: { ...current.detail, app: { ...current.detail.app, audience } } }
            : current)}
        /> : <section className={views.section}>
          <h2>App access</h2><p className={styles.muted}>{audienceLabel(app.audience)}. Contact an app maintainer to change access.</p>
        </section>}
      </div>
      <div hidden={activeView !== "sharing"} className={views.panel}>
        {canShare ? <ExternalSharingPanel
          appId={app.id}
          appName={app.name}
          appUrl={app.url}
          activeReleaseId={app.activeReleaseId}
          role={workspace?.role}
          onChange={() => setAttempt((value) => value + 1)}
        /> : <section className={views.section}>
          <h2>Guests and public web</h2><p className={styles.muted}>A workspace owner or admin can invite guests and publish this app&apos;s static pages.</p>
        </section>}
      </div>
    </div>
  );
}

export function AppOverview() {
  const params = useSearchParams();
  const appId = params.get("appId");
  const requestedView = params.get("view");
  const view = requestedView === "access" || requestedView === "sharing" || requestedView === "operations" ? requestedView : "overview";
  const { state } = useSession();
  if (state.kind !== "ready") return null;
  if (!appId) return <section>
    <h1>Choose an app</h1>
    <p className={styles.muted}>Open an app from your workspace to see its details.</p>
    <Link className={styles.primary} href="/workspaces/">Your workspaces</Link>
  </section>;
  return <AppContent key={appId} appId={appId} session={state.session} view={view} />;
}
