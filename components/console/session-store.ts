import { errorMessage, isSignInRequired, type Session } from "./api";

export type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; session: Session; refreshing: boolean; refreshError: string | null }
  | { kind: "error"; error: unknown };

const initial: SessionState = { kind: "loading" };

/** One in-memory session owner for the mounted console, never persisted as authorization. */
export function createSessionStore(loadSession: (signal: AbortSignal) => Promise<Session>, now = Date.now) {
  let state = initial;
  let checkedAt = 0;
  let generation = 0;
  let pending: { controller: AbortController; promise: Promise<void> } | null = null;
  const listeners = new Set<() => void>();
  function publish(next: SessionState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function refresh(): Promise<void> {
    if (pending) return pending.promise;
    const controller = new AbortController();
    const currentGeneration = generation;
    if (state.kind === "ready") publish({ ...state, refreshing: true, refreshError: null });
    else publish(initial);
    const promise = loadSession(controller.signal).then(
      (session) => {
        if (generation !== currentGeneration || controller.signal.aborted) return;
        checkedAt = now();
        publish({ kind: "ready", session, refreshing: false, refreshError: null });
      },
      (error: unknown) => {
        if (generation !== currentGeneration || controller.signal.aborted) return;
        if (state.kind === "ready" && !isSignInRequired(error))
          publish({ ...state, refreshing: false, refreshError: errorMessage(error) });
        else publish({ kind: "error", error });
        throw error;
      },
    ).finally(() => { if (pending?.controller === controller) pending = null; });
    pending = { controller, promise };
    return promise;
  }
  function abortPending() {
    generation++;
    pending?.controller.abort();
    pending = null;
  }
  function cancel() {
    abortPending();
    if (state.kind === "ready" && state.refreshing)
      publish({ ...state, refreshing: false });
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    refresh,
    ensure() { return state.kind === "ready" && now() - checkedAt < 60_000 ? Promise.resolve() : refresh(); },
    reset() { abortPending(); checkedAt = 0; publish(initial); },
    invalidate(error: unknown) { abortPending(); checkedAt = 0; publish({ kind: "error", error }); },
    cancel,
  };
}
