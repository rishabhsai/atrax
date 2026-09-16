import type { Metadata } from "next";
import { Suspense } from "react";
import { SignIn } from "@/components/console/SignIn";
import { AuthFrame } from "@/components/console/ConsoleFrame";

export const metadata: Metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <h1>Confirm your sign-in</h1>
          <p role="status">Loading sign-in…</p>
        </AuthFrame>
      }
    >
      <SignIn confirmation />
    </Suspense>
  );
}
