import { Suspense } from "react";
import { WorkspaceConsole } from "@/components/console/WorkspaceConsole";
import { PageLoading } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Apps",
  description: "Your team's apps in Atrax.",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkspaceConsole showApps />
    </Suspense>
  );
}
