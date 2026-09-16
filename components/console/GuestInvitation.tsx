"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, errorMessage, isSignInRequired, operation } from "./api";
import { AuthFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import consoleStyles from "./console.module.css";
import styles from "./external-sharing.module.css";

type Acceptance = { guest: { appId: string } };

function message(error: unknown) {
  if (!(error instanceof ApiError)) return errorMessage(error);
  if (error.code === "invitation_email_mismatch")
    return "This invitation belongs to a different email address. Sign in with the address that received it.";
  if (error.code === "invitation_expired")
    return "This invitation has expired. Ask an administrator to send a new one.";
  if (error.code === "invitation_revoked")
    return "This invitation was revoked. Ask an administrator to send a new one.";
  if (error.code === "invitation_accepted")
    return "This invitation was already accepted.";
  return errorMessage(error);
}

export function GuestInvitation() {
  const invitationId = useSearchParams().get("id");
  const { state, retry } = useSession();
  const key = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Acceptance | null>(null);
  const returnTo = `/auth/guest-invite/?id=${encodeURIComponent(invitationId ?? "")}`;

  if (!invitationId)
    return <AuthFrame><h1>Invitation link is incomplete</h1><p className={styles.copy}>Ask the administrator to send the guest invitation again.</p></AuthFrame>;
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error")
    return <AuthFrame><h1>Accept guest invitation</h1>{isSignInRequired(state.error) ? <><p className={styles.copy}>Sign in with the exact email address that received this invitation.</p><Link className={consoleStyles.primary} href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to continue</Link></> : <><ErrorNotice message={errorMessage(state.error)} /><button className={consoleStyles.secondary} onClick={retry}>Try again</button></>}</AuthFrame>;
  if (accepted)
    return <AuthFrame><h1>App access added</h1><p className={styles.copy}>You can now open the app using its shared link. Your guest access is limited to that app and its explicitly shared actions.</p><Link className={consoleStyles.primary} href={`/workspace/app/?appId=${encodeURIComponent(accepted.guest.appId)}`}>Open app details</Link></AuthFrame>;

  async function accept() {
    setPending(true);
    setFailure(null);
    key.current ??= crypto.randomUUID();
    try {
      const result = await operation("apps.guests.accept", { invitationId }, (value) => value as Acceptance, { key: key.current });
      setAccepted(result);
    } catch (error) {
      setFailure(message(error));
    } finally {
      setPending(false);
    }
  }

  return <AuthFrame><h1>Accept app invitation</h1><p className={styles.copy}>You are signed in as <strong>{state.session.person.email}</strong>. Accepting gives you access to one app only. It does not add you to the company workspace or Library.</p>{failure && <ErrorNotice message={failure} />}<div className={consoleStyles.actions}><button className={consoleStyles.primary} disabled={pending} onClick={accept}>{pending ? "Adding access…" : "Accept invitation"}</button><Link className={consoleStyles.secondary} href={`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`}>Use another email</Link><Link href="/account/">Cancel</Link></div></AuthFrame>;
}
