"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api, ApiError, onSessionFailure } from "./api";
import { createSessionStore, type SessionState } from "./session-store";

type ConsoleSession = {
  state: SessionState;
  retry: () => void;
  refreshSession: () => Promise<void>;
  reloadIdentity: () => Promise<void>;
  endSession: () => void;
  selectedWorkspaceId: string | null;
  selectWorkspace: (workspaceId: string | null) => void;
};
const Context = createContext<ConsoleSession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSessionStore(api.getSession));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [selectedWorkspaceId, selectWorkspace] = useState<string | null>(null);
  const path = usePathname();
  const retry = useCallback(() => { void store.refresh().catch(() => {}); }, [store]);
  const refreshSession = useCallback(() => {
    store.cancel();
    return store.refresh();
  }, [store]);
  const reloadIdentity = useCallback(() => {
    selectWorkspace(null);
    store.reset();
    return store.refresh();
  }, [store]);
  const endSession = useCallback(() => {
    selectWorkspace(null);
    store.invalidate(new ApiError("Your session has ended. Sign in to continue.", "unauthorized", false));
  }, [store]);

  useEffect(() => {
    const ensure = () => { if (document.visibilityState === "visible") void store.ensure().catch(() => {}); };
    ensure();
    window.addEventListener("focus", ensure);
    document.addEventListener("visibilitychange", ensure);
    const unsubscribe = onSessionFailure(() => {
      if (store.getSnapshot().kind === "ready") void reloadIdentity().catch(() => {});
    });
    return () => {
      window.removeEventListener("focus", ensure);
      document.removeEventListener("visibilitychange", ensure);
      unsubscribe();
      store.cancel();
    };
  }, [store, reloadIdentity]);
  useEffect(() => { void store.ensure().catch(() => {}); }, [path, store]);
  useEffect(() => {
    if (state.kind !== "ready") return;
    const timer = window.setTimeout(() => {
      if (Date.now() >= state.session.session.expiresAt) endSession();
      else retry();
    }, Math.min(2_147_483_647, Math.max(0, state.session.session.expiresAt - Date.now())));
    return () => window.clearTimeout(timer);
  }, [state, endSession, retry]);

  const value = useMemo(() => ({ state, retry, refreshSession, reloadIdentity, endSession, selectedWorkspaceId, selectWorkspace }), [state, retry, refreshSession, reloadIdentity, endSession, selectedWorkspaceId]);
  return <Context value={value}>{children}</Context>;
}

export function useConsoleSession() {
  const session = useContext(Context);
  if (!session) throw new Error("Console session must be read inside SessionProvider.");
  return session;
}
