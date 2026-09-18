"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { SessionProvider } from "../../components/console/SessionProvider";
import { ConsoleOpening, WorkspaceShell } from "../../components/console/ConsoleFrame";

export function SiteFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const workspacePage = ["/workspaces", "/workspace"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const authPage = ["/sign-in", "/auth"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (workspacePage || authPage) return <SessionProvider>{workspacePage ? <Suspense fallback={<ConsoleOpening />}><WorkspaceShell>{children}</WorkspaceShell></Suspense> : children}</SessionProvider>;
  return <><SiteHeader key={path} />{children}<SiteFooter /></>;
}
