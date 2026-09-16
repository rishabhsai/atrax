import { Suspense } from "react";
import { WorkspaceConsole } from "@/components/console/WorkspaceConsole";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Account",
  description: "Sign in and open your Atrax workspace.",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <WorkspaceConsole />
    </Suspense>
  );
}
