import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "./components/site-footer";
import { siteConfig } from "../config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Search live book inventory across participating charity shops and find affordable books near you.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.publicUrl),
  applicationName: siteConfig.searchName,
  title: {
    default: "Giveleaf Books | Find Books in Charity Shops",
    template: "%s | Giveleaf Books",
  },
  description: siteDescription,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    url: siteConfig.publicUrl,
    siteName: siteConfig.searchName,
    title: "Giveleaf Books | Find Books in Charity Shops",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Giveleaf Books | Find Books in Charity Shops",
    description: siteDescription,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.searchName,
  alternateName: siteConfig.name,
  url: siteConfig.publicUrl,
  description: siteDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
