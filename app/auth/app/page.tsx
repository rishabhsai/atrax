import { Suspense } from "react";
import { AppSignIn } from "@/components/console/AppSignIn";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "App sign-in",
  robots: { index: false, follow: false },
};

export default function AppSignInPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <AppSignIn />
    </Suspense>
  );
}
