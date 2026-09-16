"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, errorMessage, isSignInRequired, workspaceUrl } from "./api";
import { AuthFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { useSession, useSubmission } from "./useConsole";
import styles from "./console.module.css";

export function Invitation() {
  const params = useSearchParams();
  const invitationId = params.get("id");
  const router = useRouter();
  const { state, retry } = useSession();
  const command = useSubmission();
  const returnTo = `/auth/invite/?id=${encodeURIComponent(invitationId || "")}`;
  const signInUrl = `/sign-in/?returnTo=${encodeURIComponent(returnTo)}`;
  async function accept() {
    if (!invitationId) return;
    const result = await command.run(invitationId, (key) =>
      api.acceptInvitation({ invitationId }, key),
    );
    if (result) router.replace(workspaceUrl(result.id));
  }
  if (!invitationId)
    return (
      <AuthFrame>
        <h1>Invitation link incomplete</h1>
        <p className={styles.muted}>
          Open the invitation link from your email to continue.
        </p>
        <Link className={styles.secondary} href="/account/">
          Open your account
        </Link>
      </AuthFrame>
    );
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error")
    return (
      <AuthFrame>
        <h1>Join your team</h1>
        {isSignInRequired(state.error) ? (
          <>
            <p className={styles.muted}>
              Sign in with the email address that received this invitation.
            </p>
            <Link className={styles.primary} href={signInUrl}>
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
  const invitation = state.session.invitations.find(
    (item) => item.id === invitationId,
  );
  return (
    <AuthFrame>
      <h1>
        {invitation
          ? `Join ${invitation.workspaceName}`
          : "Continue with your invitation"}
      </h1>
      <p className={styles.muted}>
        {invitation
          ? "Accept this invitation to open your team's workspace."
          : "Continue to check this invitation. If you've already joined, we'll open your workspace."}
      </p>
      <dl className={styles.details}>
        <div>
          <dt>Signed in as</dt>
          <dd>{state.session.person.email}</dd>
        </div>
        {invitation && (
          <>
            <div>
              <dt>Workspace role</dt>
              <dd className={styles.role}>{invitation.role}</dd>
            </div>
            <div>
              <dt>Invitation expires</dt>
              <dd>
                <time dateTime={new Date(invitation.expiresAt).toISOString()}>
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </time>
              </dd>
            </div>
          </>
        )}
      </dl>
      {command.state.kind === "error" && (
        <ErrorNotice message={command.state.message} />
      )}
      <div className={`${styles.actions} ${styles.inlineNote}`}>
        <button
          className={styles.primary}
          disabled={command.state.kind === "pending"}
          onClick={accept}
        >
          {command.state.kind === "pending"
            ? "Opening workspace…"
            : invitation
              ? "Accept invitation"
              : "Continue"}
        </button>
        <Link className={styles.secondary} href={signInUrl}>
          Use another email
        </Link>
      </div>
    </AuthFrame>
  );
}
