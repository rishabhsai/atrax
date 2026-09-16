import { Suspense } from "react";
import { LibraryConsole } from "@/components/console/LibraryConsole";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Library",
  description: "Company files and guidance for your team.",
  robots: { index: false, follow: false },
};

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <LibraryConsole />
    </Suspense>
  );
}
