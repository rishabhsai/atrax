"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  appOverviewUrl,
  appStatus,
  audienceLabel,
  errorMessage,
  isSignInRequired,
  workspaceUrl,
  type AppDetails,
  type Session,
} from "./api";
import {
  AuthFrame,
  ConsoleFrame,
  ErrorNotice,
  LoadingPanel,
} from "./ConsoleFrame";
import { useSession } from "./useConsole";
import { ExternalSharingPanel } from "./ExternalSharingPanel";
import { SharingPanel } from "./SharingPanel";
import styles from "./console.module.css";

type AppState =
  | { kind: "loading" }
  | { kind: "ready"; detail: AppDetails }
  | { kind: "error"; message: string };

function AppContent({ appId, session }: { appId: string; session: Session }) {
  const [state, setState] = useState<AppState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.getApp(appId, controller.signal).then(
      (detail) => setState({ kind: "ready", detail }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [appId, attempt]);
  if (state.kind === "loading")
    return (
      <ConsoleFrame session={session}>
        <h1>Opening app details</h1>
        <div className={styles.skeleton} aria-hidden="true" />
        <p role="status">Loading app…</p>
      </ConsoleFrame>
    );
  if (state.kind === "error")
    return (
      <ConsoleFrame session={session}>
        <h1>Couldn&apos;t open this app</h1>
        <ErrorNotice message={state.message} />
        <div className={`${styles.actions} ${styles.inlineNote}`}>
          <button
            className={styles.secondary}
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
          <Link href="/account/">Your workspaces</Link>
        </div>
      </ConsoleFrame>
    );
  const { app, capabilities, release } = state.detail;
  const workspace = session.workspaces.find(
    (item) => item.id === app.workspaceId,
  );
  return (
    <ConsoleFrame session={session} workspace={workspace}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href={workspaceUrl(app.workspaceId)}>Home</Link>
        <span aria-hidden="true">/</span>
        <span>{app.name}</span>
      </nav>
      <header className={styles.pageHeader}>
        <div>
          <h1>{app.name}</h1>
          <p>
            {app.activeReleaseId && capabilities.canOpen ? (
              <a href={app.url}>{app.url}</a>
            ) : app.activeReleaseId ? (
              "This app is not shared with you. You can still manage its maintainers."
            ) : (
              "Deploy this app to make it available to your team."
            )}
          </p>
        </div>
        {capabilities.canOpen && app.activeReleaseId && app.status !== "deleted" && (
          <a className={styles.primary} href={app.url}>
            Open app
          </a>
        )}
      </header>
      <dl className={`${styles.details} ${styles.appDetails}`}>
        <div>
          <dt>Deployment</dt>
          <dd>
            <span className={styles.status}>{appStatus(app.status)}</span>
          </dd>
        </div>
        <div>
          <dt>App access</dt>
          <dd>{audienceLabel(app.audience)}</dd>
        </div>
        <div>
          <dt>Workspace</dt>
          <dd>{workspace?.name || "Workspace"}</dd>
        </div>
        <div>
          <dt>Maintenance</dt>
          <dd>
            {capabilities.maintain
              ? "You can change and deploy this app."
              : capabilities.canManageMaintainers
                ? "You can assign this app's maintainers."
                : "Managed by the app's maintainers."}
          </dd>
        </div>
      </dl>
      {capabilities.maintain && (
        <section className={styles.section}>
          <h2>Current release</h2>
          {release ? (
            <dl className={styles.details}>
              <div>
                <dt>Release</dt>
                <dd>
                  <code>{release.id}</code>
                </dd>
              </div>
              <div>
                <dt>Deployed</dt>
                <dd>
                  <time dateTime={new Date(release.createdAt).toISOString()}>
                    {new Date(release.createdAt).toLocaleString()}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Artifact</dt>
                <dd>
                  <code>{release.hash}</code>
                </dd>
              </div>
            </dl>
          ) : (
            <p className={styles.muted}>
              No active release has been published.
            </p>
          )}
          <p className={styles.muted}>
            Deploy updates from the app&apos;s project using the Atrax CLI.
          </p>
          <Link href="/docs/quickstart/">Deployment instructions</Link>
        </section>
      )}
      {capabilities.canOpen && release && (
        <section className={styles.section}>
          <h2>App actions</h2>
          {release.actions.length ? (
            <ul className={styles.list}>
              {release.actions.map((action) => (
                <li className={styles.actionRow} key={action.name}>
                  <code>{action.name}</code>
                  <p className={styles.muted}>{action.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>
              This release does not expose any named actions.
            </p>
          )}
        </section>
      )}
      <SharingPanel
        appId={app.id}
        workspaceId={app.workspaceId}
        actionNames={release?.actions.map((action) => action.name) ?? []}
        canManageAccess={capabilities.manageAccess}
        canManageMaintainers={capabilities.canManageMaintainers}
        onAppAccessSaved={(audience) =>
          setState({
            kind: "ready",
            detail: { ...state.detail, app: { ...app, audience } },
          })
        }
      />
      <ExternalSharingPanel
        appId={app.id}
        appName={app.name}
        appUrl={app.url}
        activeReleaseId={app.activeReleaseId}
        role={workspace?.role}
        onChange={() => {
          setState({ kind: "loading" });
          setAttempt((value) => value + 1);
        }}
      />
    </ConsoleFrame>
  );
}

export function AppOverview() {
  const params = useSearchParams();
  const appId = params.get("appId");
  const { state, retry } = useSession();
  if (!appId)
    return (
      <AuthFrame>
        <h1>Choose an app</h1>
        <p className={styles.muted}>
          Open an app from your workspace to see its details.
        </p>
        <Link className={styles.primary} href="/account/">
          Your workspaces
        </Link>
      </AuthFrame>
    );
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error")
    return (
      <AuthFrame>
        <h1>Open app details</h1>
        {isSignInRequired(state.error) ? (
          <>
            <p className={styles.muted}>Sign in to see this app.</p>
            <Link
              className={styles.primary}
              href={`/sign-in/?returnTo=${encodeURIComponent(appOverviewUrl(appId))}`}
            >
              Sign in to continue
            </Link>
          </>
        ) : (
          <>
            <ErrorNotice message={errorMessage(state.error)} />
            <div className={styles.inlineNote}>
              <button className={styles.secondary} onClick={retry}>
                Try again
              </button>
            </div>
          </>
        )}
      </AuthFrame>
    );
  return <AppContent key={appId} appId={appId} session={state.session} />;
}
