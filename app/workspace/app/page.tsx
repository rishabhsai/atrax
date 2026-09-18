import { Suspense } from "react";
import { AppOverview } from "@/components/console/AppOverview";
import { PageLoading } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "App overview",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AppOverview />
    </Suspense>
  );
}
