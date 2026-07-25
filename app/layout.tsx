import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tarantula-9l0.pages.dev"),
  title: {
    default: "Tarantula — The tiny cloud for agent-built software",
    template: "%s — Tarantula",
  },
  description:
    "Build with an agent, deploy in one command, connect company tools, share knowledge, and invite your team.",
  openGraph: {
    title: "Tarantula — The tiny cloud for agent-built software",
    description:
      "Build it with an agent. Deploy it in one command.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarantula — The tiny cloud for agent-built software",
    description:
      "Build it with an agent. Deploy it in one command.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
