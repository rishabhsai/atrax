import { DocsShell } from "../components/DocsShell";
import { docs } from "../lib/docs";

export const metadata = {
  title: "Docs",
  description:
    "Install Tarantula, deploy the public chat, and inspect the live Cloudflare resources.",
};

export default function DocsPage() {
  return <DocsShell doc={docs.quickstart} />;
}
