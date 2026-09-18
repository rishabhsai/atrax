import { PageLoading } from "@/components/console/ConsoleFrame";
import { Suspense } from "react";
import { TeamConsole } from "@/components/console/TeamConsole";

export const metadata = { title: "Team", robots: { index: false, follow: false } };

export default function TeamPage() {
  return <Suspense fallback={<PageLoading />}><TeamConsole /></Suspense>;
}
