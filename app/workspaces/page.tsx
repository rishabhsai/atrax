import { Suspense } from "react";
import { WorkspaceConsole } from "@/components/console/WorkspaceConsole";
import { PageLoading } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Workspaces",
  description: "Choose a workspace in Atrax.",
};

export default function WorkspacesPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkspaceConsole />
    </Suspense>
  );
}
