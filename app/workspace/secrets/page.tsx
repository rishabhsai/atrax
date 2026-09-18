import { Suspense } from "react";
import { SecretsConsole } from "@/components/console/SecretsConsole";
import { PageLoading } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Secrets",
  description: "Credentials for your workspace apps.",
  robots: { index: false, follow: false },
};

export default function SecretsPage() {
  return <Suspense fallback={<PageLoading />}><SecretsConsole /></Suspense>;
}
