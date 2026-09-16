import { Suspense } from "react";
import { GuestInvitation } from "@/components/console/GuestInvitation";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = { title: "Guest invitation", robots: { index: false, follow: false } };

export default function GuestInvitationPage() {
  return <Suspense fallback={<LoadingPanel />}><GuestInvitation /></Suspense>;
}
