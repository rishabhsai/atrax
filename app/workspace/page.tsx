import { Suspense } from "react";
import { WorkspaceConsole } from "@/components/console/WorkspaceConsole";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Workspace",
  description: "Your team's apps in Atrax.",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <WorkspaceConsole home />
    </Suspense>
  );
}
