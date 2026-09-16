import { Suspense } from "react";
import { DeviceApproval } from "@/components/console/DeviceApproval";
import { LoadingPanel } from "@/components/console/ConsoleFrame";

export const metadata = {
  title: "Connect CLI",
  robots: { index: false, follow: false },
};

export default function DevicePage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <DeviceApproval />
    </Suspense>
  );
}
