"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, isSignInRequired } from "./api";
import { AuthFrame, ErrorNotice, LoadingPanel } from "./ConsoleFrame";
import { useSession } from "./useConsole";
import styles from "./console.module.css";

function ContinueToApp({
  appId,
  state,
  hostname,
}: {
  appId: string;
  state: string;
  hostname: string;
}) {
  const key = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    key.current ??= crypto.randomUUID();
    api.loginApp({ appId, state, hostname }, key.current).then(
      ({ redirectUrl }) => {
        if (active) window.location.replace(redirectUrl);
      },
      (failure: unknown) => {
        if (active) setError(errorMessage(failure));
      },
    );
    return () => {
      active = false;
    };
  }, [appId, state, hostname, attempt]);
  return (
    <AuthFrame>
      <h1>{error ? "Couldn't open this app" : "Opening your app"}</h1>
      {error ? (
        <>
          <ErrorNotice message={error} />
          <div className={`${styles.actions} ${styles.inlineNote}`}>
            <button
              className={styles.secondary}
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
            <Link href="/account/">Your workspaces</Link>
          </div>
        </>
      ) : (
        <p role="status" className={styles.muted}>
          Checking your access and continuing to the app…
        </p>
      )}
    </AuthFrame>
  );
}

export function AppSignIn() {
  const params = useSearchParams();
  const appId = params.get("appId");
  const stateToken = params.get("state");
  const hostname = params.get("hostname");
  const { state, retry } = useSession();
  if (!appId || !stateToken || !hostname)
    return (
      <AuthFrame>
        <h1>Open the app again</h1>
        <p className={styles.muted}>
          This sign-in link is incomplete. Open the app from your workspace or
          its original address.
        </p>
        <Link className={styles.primary} href="/account/">
          Your workspaces
        </Link>
      </AuthFrame>
    );
  if (state.kind === "loading") return <LoadingPanel />;
  if (state.kind === "error") {
    const returnTo = `/auth/app/?${new URLSearchParams({ appId, state: stateToken, hostname })}`;
    return (
      <AuthFrame>
        <h1>Sign in to your app</h1>
        {isSignInRequired(state.error) ? (
          <>
            <p className={styles.muted}>
              Use your workspace email to continue.
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
  }
  return (
    <ContinueToApp
      key={`${appId}:${stateToken}`}
      appId={appId}
      state={stateToken}
      hostname={hostname}
    />
  );
}
