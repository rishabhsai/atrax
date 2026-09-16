"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  appOverviewUrl,
  appStatus,
  audienceLabel,
  errorMessage,
  isSignInRequired,
  workspaceUrl,
  type App,
  type Session,
} from "./api";
import {
  AuthFrame,
  ConsoleFrame,
  ErrorNotice,
  LoadingPanel,
} from "./ConsoleFrame";
import { CreateWorkspace } from "./CreateWorkspace";
import { useSession } from "./useConsole";
import styles from "./console.module.css";

function WorkspaceSelection({ session }: { session: Session }) {
  const router = useRouter();
  return (
    <ConsoleFrame session={session}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Your workspaces</h1>
          <p>Choose where you want to work.</p>
        </div>
      </header>
      {session.workspaces.length ? (
        <ul className={styles.list}>
          {session.workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link
                href={workspaceUrl(workspace.id)}
                className={styles.workspaceLink}
              >
                <span>
                  <strong>{workspace.name}</strong>
                  <small className={styles.role}>{workspace.role}</small>
                </span>
                <span>Open workspace</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2>Your team starts here</h2>
          <p>
            Create a workspace below, or open an invitation sent by your team.
          </p>
        </div>
      )}
      {session.invitations.length > 0 && (
        <section className={styles.section}>
          <h2>Workspace invitations</h2>
          <ul className={styles.list}>
            {session.invitations.map((invitation) => (
              <li key={invitation.id}>
                <Link
                  className={styles.workspaceLink}
                  href={`/auth/invite/?id=${encodeURIComponent(invitation.id)}`}
                >
                  <span>
                    <strong>{invitation.workspaceName}</strong>
                    <small>Invited as {invitation.role}</small>
                  </span>
                  <span>Review invitation</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CreateWorkspace
        onCreated={(workspace) => router.push(workspaceUrl(workspace.id))}
      />
    </ConsoleFrame>
  );
}

type AppsState =
  | { kind: "loading" }
  | { kind: "ready"; apps: App[] }
  | { kind: "error"; message: string };

function AppDirectory({ workspaceId }: { workspaceId: string }) {
  const params = useSearchParams();
  const [state, setState] = useState<AppsState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(params.get("q") || "");
  function updateQuery(value: string) {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
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
      <section className={styles.empty}>
        <h2>No apps are available yet</h2>
        <p>
          Deploy an app with your agent to make it available to your team here.
        </p>
        <Link href="/docs/quickstart/" className={styles.primary}>
          Create an app
        </Link>
      </section>
    );
  const visible = state.apps
    .filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <div className={`${styles.field} ${styles.search}`}>
        <label htmlFor="app-search">Find an app</label>
        <input
          id="app-search"
          type="search"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
        />
      </div>
      {visible.length ? (
        <ul className={styles.list}>
          {visible.map((app) => (
            <li key={app.id} className={styles.appRow}>
              <div>
                <Link href={appOverviewUrl(app.id)}>
                  <strong>{app.name}</strong>
                </Link>
                <div className={styles.small}>
                  {audienceLabel(app.audience)}
                  {app.canMaintain ? " · You maintain this" : ""}
                  {!app.canOpen && app.canManageMaintainers ? " · Settings only" : ""}
                </div>
              </div>
              <span className={styles.status}>{appStatus(app.status)}</span>
              {app.canOpen && app.activeReleaseId && app.status !== "deleted" && (
                <a className={styles.secondary} href={app.url}>
                  Open app
                </a>
              )}
              {!app.canOpen && app.canManageMaintainers && (
                <Link className={styles.secondary} href={appOverviewUrl(app.id)}>
                  Settings
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <h2>No apps match &quot;{query}&quot;</h2>
          <button className={styles.secondary} onClick={() => updateQuery("")}>
            Clear filter
          </button>
        </div>
      )}
    </>
  );
}

export function WorkspaceConsole({ home = false }: { home?: boolean }) {
  const { state, retry } = useSession();
  const params = useSearchParams();
  const requestedWorkspace = params.get("workspace");
  const returnTo =
    home && requestedWorkspace ? workspaceUrl(requestedWorkspace) : "/account/";
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error")
    return (
      <AuthFrame>
        <h1>
          {isSignInRequired(state.error)
            ? "Sign in to your workspace"
            : "Couldn't open your account"}
        </h1>
        {isSignInRequired(state.error) ? (
          <>
            <p className={styles.muted}>
              Use your email to return to your team&apos;s apps.
            </p>
            <Link
              className={styles.primary}
              href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}
            >
              Continue with email
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
  const session = state.session;
  if (!home || !requestedWorkspace)
    return <WorkspaceSelection session={session} />;
  const workspace = session.workspaces.find(
    (item) => item.id === requestedWorkspace,
  );
  if (!workspace)
    return (
      <ConsoleFrame session={session}>
        <h1>Workspace unavailable</h1>
        <p className={styles.muted}>
          This workspace isn&apos;t available to your account.
        </p>
        <Link className={styles.primary} href="/account/">
          Choose a workspace
        </Link>
      </ConsoleFrame>
    );
  return (
    <ConsoleFrame session={session} workspace={workspace}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Home</h1>
          <p>{workspace.name}</p>
        </div>
        <Link className={styles.secondary} href="/docs/quickstart/">
          Create an app
        </Link>
      </header>
      <AppDirectory key={workspace.id} workspaceId={workspace.id} />
    </ConsoleFrame>
  );
}
