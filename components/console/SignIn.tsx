"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { api, safeReturnTo } from "./api";
import { AuthFrame, ErrorNotice } from "./ConsoleFrame";
import { useSession, useSubmission } from "./useConsole";
import styles from "./console.module.css";

type Step =
  | { kind: "email" }
  | { kind: "link" }
  | { kind: "sent"; email: string; expiresAt: number };

export function SignIn({ confirmation = false }: { confirmation?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [step, setStep] = useState<Step>(
    confirmation ? { kind: "link" } : { kind: "email" },
  );
  const [email, setEmail] = useState("");
  const link = useRef<{ challengeId: string; secret: string } | null>(null);
  const command = useSubmission();
  const { reloadIdentity } = useSession();
  const pending = command.state.kind === "pending";

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: Parameters<typeof api.startEmail>[0] = {
      email: email.trim(),
      returnTo,
      purpose: "sign_in",
    };
    const result = await command.run(JSON.stringify(input), (key) =>
      api.startEmail(input, key),
    );
    if (result)
      setStep({
        kind: "sent",
        email: input.email,
        expiresAt: result.expiresAt,
      });
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link.current) {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      link.current = {
        challengeId: fragment.get("challengeId") || "",
        secret: fragment.get("secret") || "",
      };
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    const input = link.current;
    const result = await command.run(JSON.stringify(input), (key) => {
      if (!input.challengeId || !input.secret)
        throw new Error(
          "This sign-in link is incomplete. Request another email to continue.",
        );
      return api.verifyEmail(input, key).then(async (verified) => {
        await reloadIdentity();
        return verified;
      });
    });
    if (!result) return;
    link.current = null;
    router.replace(safeReturnTo(result.returnTo));
  }

  function startAgain() {
    command.clearError();
    link.current = null;
    setStep({ kind: "email" });
    if (confirmation)
      router.replace(`/sign-in/?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <AuthFrame>
      {step.kind === "email" ? (
        <>
          <h1>Sign in to Atrax</h1>
          <p className={styles.muted}>
            Use your email to open your workspaces or create one for your team.
          </p>
          <form className={styles.form} onSubmit={sendEmail}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {command.state.kind === "error" && (
              <ErrorNotice message={command.state.message} />
            )}
            <button className={styles.primary} disabled={pending} type="submit">
              {pending ? "Sending email…" : "Email me a sign-in link"}
            </button>
          </form>
        </>
      ) : step.kind === "sent" ? (
        <>
          <h1>Check your email</h1>
          <p role="status" className={styles.muted}>
            We sent a sign-in link to{" "}
            <strong className={styles.email}>{step.email}</strong>. Open it to
            continue.
          </p>
          <p className={styles.small}>
            The link expires at{" "}
            <time dateTime={new Date(step.expiresAt).toISOString()}>
              {new Date(step.expiresAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
            .
          </p>
          <button
            className={styles.textButton}
            type="button"
            onClick={startAgain}
          >
            Send another email or use a different address
          </button>
        </>
      ) : (
        <>
          <h1>Confirm your sign-in</h1>
          <p className={styles.muted}>
            Continue to verify your email and sign in to Atrax.
          </p>
          <form className={styles.form} onSubmit={verify}>
            {command.state.kind === "error" && (
              <ErrorNotice message={command.state.message} />
            )}
            <button className={styles.primary} disabled={pending} type="submit">
              {pending ? "Signing in…" : "Continue"}
            </button>
            <button
              className={styles.textButton}
              disabled={pending}
              type="button"
              onClick={startAgain}
            >
              Request another sign-in email
            </button>
          </form>
        </>
      )}
      <p className={`${styles.small} ${styles.inlineNote}`}>
        <Link href="/">Back to Atrax</Link>
      </p>
    </AuthFrame>
  );
}
