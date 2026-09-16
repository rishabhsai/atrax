import { Suspense } from "react";
import { Invitation } from "@/components/console/Invitation";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Workspace invitation",
  robots: { index: false, follow: false },
};

export default function InvitationPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <Invitation />
    </Suspense>
  );
}
