import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { GoogleAnalytics } from "@/components/consent/GoogleAnalytics";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Calymia",
  description: "Plateforme SaaS pour sophrologues",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-FR" className={`${playfair.variable} ${dmSans.variable}`}>
      <body
        className={`${dmSans.className} bg-white text-slate-900 antialiased`}
      >
        {children}
        <GoogleAnalytics />
        <CookieConsentBanner />
      </body>
    </html>
  );
}

