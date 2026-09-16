import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";
import { SiteFrame } from "./components/SiteFrame";
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
    default: "Atrax | A cloud for internal software",
    template: "%s | Atrax",
  },
  description:
    "Build internal apps with your agent. Deploy, share with verified people, and keep company knowledge together.",
  openGraph: {
    title: "Atrax | A cloud for internal software",
    description:
      "Company-owned apps, verified access, connected actions, and shared knowledge for your team and its agents.",
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
    title: "Atrax | A cloud for internal software",
    description:
      "Company-owned apps, verified access, connected actions, and shared knowledge for your team and its agents.",
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
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
