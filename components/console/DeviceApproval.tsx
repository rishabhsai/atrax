"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  errorMessage,
  isSignInRequired,
  type Invitation,
  type Session,
  type Workspace,
} from "./api";
import { AuthFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { CreateWorkspace } from "./CreateWorkspace";
import { useSession, useSubmission } from "./useConsole";
import styles from "./console.module.css";

type RequestState =
  | { kind: "loading" }
  | { kind: "ready"; request: Awaited<ReturnType<typeof api.getDevice>> }
  | { kind: "error"; message: string };

function DeviceRequest({
  userCode,
  session,
  changeCode,
}: {
  userCode: string;
  session: Session;
  changeCode: () => void;
}) {
  const [state, setState] = useState<RequestState>({ kind: "loading" });
  const [outcome, setOutcome] = useState<"approved" | "denied" | null>(null);
  const [onboardedWorkspace, setOnboardedWorkspace] =
    useState<Workspace | null>(null);
  const [attempt, setAttempt] = useState(0);
  const command = useSubmission();
  const invitationCommand = useSubmission();
  useEffect(() => {
    const controller = new AbortController();
    api.getDevice(userCode, controller.signal).then(
      (request) => setState({ kind: "ready", request }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ kind: "error", message: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [userCode, attempt]);

  async function decide(decision: "approve" | "deny") {
    const input = { userCode, decision };
    const result = await command.run(JSON.stringify(input), (key) =>
      api.approveDevice(input, key),
    );
    if (result) setOutcome(result.status);
  }

  async function acceptInvitation(invitation: Invitation) {
    const result = await invitationCommand.run(invitation.id, (key) =>
      api.acceptInvitation({ invitationId: invitation.id }, key),
    );
    if (result) setOnboardedWorkspace(result);
  }

  if (outcome)
    return (
      <>
        <h1>
          {outcome === "approved" ? "CLI connected" : "Connection declined"}
        </h1>
        <p role="status" className={styles.success}>
          {outcome === "approved"
            ? "Return to your terminal to continue."
            : "This request has been denied. The CLI has not received access."}
        </p>
        <Link className={styles.secondary} href="/workspaces/">
          Open your workspaces
        </Link>
      </>
    );
  if (state.kind === "loading")
    return (
      <>
        <h1>Check your CLI request</h1>
        <div className={styles.skeleton} aria-hidden="true" />
        <p role="status">Loading connection details…</p>
      </>
    );
  if (state.kind === "error")
    return (
      <>
        <h1>Couldn&apos;t open this request</h1>
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
          <button className={styles.textButton} onClick={changeCode}>
            Use another code
          </button>
        </div>
      </>
    );
  if (state.request.status !== "pending")
    return (
      <>
        <h1>
          {state.request.status === "expired"
            ? "This request has expired"
            : "This request is already resolved"}
        </h1>
        <p className={styles.muted}>
          Start a new sign-in from your terminal to connect a CLI.
        </p>
        <button className={styles.secondary} onClick={changeCode}>
          Enter a new code
        </button>
      </>
    );
  return (
    <>
      <h1>Connect your CLI</h1>
      <p className={styles.muted}>
        Check that this code matches the terminal where you started signing in.
      </p>
      <dl className={styles.details}>
        <div>
          <dt>Code from your terminal</dt>
          <dd className={styles.code}>{userCode}</dd>
        </div>
        <div>
          <dt>Requesting CLI</dt>
          <dd>{state.request.clientName}</dd>
        </div>
        {state.request.agentLabel && (
          <div>
            <dt>Agent</dt>
            <dd>{state.request.agentLabel}</dd>
          </div>
        )}
        <div>
          <dt>Signed in as</dt>
          <dd>{session.person.email}</dd>
        </div>
        <div>
          <dt>Request expires</dt>
          <dd>
            <time dateTime={new Date(state.request.expiresAt).toISOString()}>
              {new Date(state.request.expiresAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </dd>
        </div>
      </dl>
      <p className={styles.muted}>
        Connecting lets this CLI act with your Atrax account permissions. Only
        connect a CLI you started.
      </p>
      {session.workspaces.length === 0 && !onboardedWorkspace && (
        <>
          {session.invitations.length > 0 && (
            <section
              className={styles.inlineNote}
              aria-labelledby="device-workspace-invitations"
            >
              <h2 id="device-workspace-invitations">Join your team</h2>
              <p className={styles.muted}>
                Accept a pending invitation so this CLI has a workspace for
                deployments.
              </p>
              {invitationCommand.state.kind === "error" && (
                <ErrorNotice message={invitationCommand.state.message} />
              )}
              <ul className={styles.list}>
                {session.invitations.map((invitation) => (
                  <li key={invitation.id} className={styles.workspaceLink}>
                    <span>
                      <strong>{invitation.workspaceName}</strong>
                      <small>Invited as {invitation.role}</small>
                    </span>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={invitationCommand.state.kind === "pending"}
                      onClick={() => acceptInvitation(invitation)}
                    >
                      Join workspace
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <CreateWorkspace
            variant="inline"
            title={
              session.invitations.length > 0
                ? "Or create a workspace"
                : "Create your first workspace"
            }
            description="Your CLI needs a workspace before it can deploy an app. You will become this workspace's owner."
            onCreated={setOnboardedWorkspace}
          />
        </>
      )}
      {onboardedWorkspace && (
        <p role="status" className={styles.success}>
          {onboardedWorkspace.name} is ready. Your CLI will use it automatically
          for your first deployment.
        </p>
      )}
      {command.state.kind === "error" && (
        <ErrorNotice message={command.state.message} />
      )}
      <div className={`${styles.actions} ${styles.inlineNote}`}>
        {(session.workspaces.length > 0 || onboardedWorkspace) && (
          <button
            type="button"
            className={styles.primary}
            disabled={command.state.kind === "pending"}
            onClick={() => decide("approve")}
          >
            {command.state.kind === "pending"
              ? "Saving decision…"
              : "Connect CLI"}
          </button>
        )}
        <button
          type="button"
          className={styles.secondary}
          disabled={command.state.kind === "pending"}
          onClick={() => decide("deny")}
        >
          Deny request
        </button>
      </div>
    </>
  );
}

export function DeviceApproval() {
  const params = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState(params.get("code") || "");
  const selectedCode = params.get("code") || "";
  const { state, retry } = useSession();
  const returnTo = `/auth/device/?code=${encodeURIComponent(code)}`;
  function selectCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.replace(`/auth/device/?code=${encodeURIComponent(code.trim())}`);
  }
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error")
    return (
      <AuthFrame>
        <h1>Connect your CLI</h1>
        {isSignInRequired(state.error) ? (
          <>
            <p className={styles.muted}>
              Sign in to review the CLI requesting access to your Atrax account.
            </p>
            <Link
              className={styles.primary}
              href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}
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
  return (
    <AuthFrame>
      {selectedCode ? (
        <DeviceRequest
          key={selectedCode}
          userCode={selectedCode}
          session={state.session}
          changeCode={() => router.replace("/auth/device/")}
        />
      ) : (
        <>
          <h1>Connect your CLI</h1>
          <p className={styles.muted}>
            Enter the code shown in your terminal to review its connection
            request.
          </p>
          <form className={styles.form} onSubmit={selectCode}>
            <div className={styles.field}>
              <label htmlFor="device-code">Code from your terminal</label>
              <input
                id="device-code"
                className={styles.code}
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
            <button className={styles.primary} type="submit">
              Review request
            </button>
          </form>
        </>
      )}
    </AuthFrame>
  );
}
