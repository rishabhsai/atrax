import type { Metadata } from "next";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tarantula-9l0.pages.dev"),
  title: {
    default: "Tarantula | An agent-native cloud for small software",
    template: "%s | Tarantula",
  },
  description:
    "Create, run, deploy, inspect, and debug small full-stack apps from one CLI.",
  openGraph: {
    title: "Tarantula | An agent-native cloud for small software",
    description:
      "Deploy a full-stack app from one CLI and get a URL to share.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarantula | An agent-native cloud for small software",
    description:
      "Deploy a full-stack app from one CLI and get a URL to share.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
