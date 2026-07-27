import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Canonical host. https://tarantula-9l0.pages.dev stays live as a secondary
  // host, so old links keep resolving; every absolute URL points here.
  metadataBase: new URL("https://atrax.run"),
  title: {
    default: "Atrax | A cloud for everyone",
    template: "%s | Atrax",
  },
  description:
    "Create, run, deploy, inspect, and debug small full-stack apps from one CLI.",
  openGraph: {
    title: "Atrax | A cloud for everyone",
    description:
      "Deploy a full-stack app from one CLI and get a URL to share.",
    type: "website",
    siteName: "Atrax",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Atrax — A cloud for everyone.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atrax | A cloud for everyone",
    description:
      "Deploy a full-stack app from one CLI and get a URL to share.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
