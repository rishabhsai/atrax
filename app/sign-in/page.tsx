import { Suspense } from "react";
import { SignIn } from "@/components/console/SignIn";
import { AuthFrame } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Sign in",
  description: "Sign in to Atrax with your email.",
};

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <h1>Sign in to Atrax</h1>
          <p role="status">Loading sign-in…</p>
        </AuthFrame>
      }
    >
      <SignIn />
    </Suspense>
  );
}
