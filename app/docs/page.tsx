import { DocsShell } from "../components/DocsShell";
import { docs } from "../lib/docs";

export const metadata = {
  title: "Docs",
  description:
    "Create and deploy company apps, share them with your team, and connect your existing agent.",
};

export default function DocsPage() {
  return <DocsShell doc={docs.quickstart} />;
}
