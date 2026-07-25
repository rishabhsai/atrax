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
  metadataBase: new URL("https://tarantula.build"),
  title: {
    default: "Tarantula — Software that keeps working",
    template: "%s — Tarantula",
  },
  description:
    "The agent-native platform for building, deploying, and operating complete software.",
  openGraph: {
    title: "Tarantula — Software that keeps working",
    description:
      "Build, deploy, and operate complete software with coding agents.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarantula — Software that keeps working",
    description:
      "Build, deploy, and operate complete software with coding agents.",
    images: ["/og.png"],
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
