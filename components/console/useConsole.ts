"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, type Session } from "./api";

type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; session: Session }
  | { kind: "error"; error: unknown };

export function useSession() {
  const [state, setState] = useState<SessionState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.getSession(controller.signal).then(
      (session) => setState({ kind: "ready", session }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", error });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return { state, retry };
}

type Submission =
  { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string };

export function useSubmission() {
  const [state, setState] = useState<Submission>({ kind: "idle" });
  const attempt = useRef<{ identity: string; key: string } | null>(null);
  const busy = useRef(false);
  async function run<T>(
    identity: string,
    action: (key: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (busy.current) return;
    busy.current = true;
    if (attempt.current?.identity !== identity)
      attempt.current = { identity, key: crypto.randomUUID() };
    setState({ kind: "pending" });
    try {
      const result = await action(attempt.current.key);
      attempt.current = null;
      setState({ kind: "idle" });
      return result;
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    } finally {
      busy.current = false;
    }
  }
  return { state, run, clearError: () => setState({ kind: "idle" }) };
}
