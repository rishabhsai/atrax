"use client";

import { useRef, useState } from "react";
import { errorMessage } from "./api";

export { useConsoleSession as useSession } from "./SessionProvider";

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
