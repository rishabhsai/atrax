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
    default: "Tarantula — A cloud for small software",
    template: "%s — Tarantula",
  },
  description:
    "Deploy and share software built by agents with hosting, workers, databases, auth, storage, secrets, and durable agent infrastructure included.",
  openGraph: {
    title: "Tarantula — A cloud for small software",
    description:
      "The small cloud for software built by agents.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarantula — A cloud for small software",
    description:
      "The small cloud for software built by agents.",
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
