// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/terms-of-use/page.tsx -- Terms of Use (2026-10-01): rules
// for using the website and app, for everyone including visitors.
// Text lives in src/lib/legal-texts.ts, word for word the app's
// lib/legal/legal_documents.dart.

import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import { TERMS_OF_USE, LEGAL_LAST_UPDATED } from "@/lib/legal-texts";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const plexSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Terms of Use — ControlMiles",
};

export default function Page() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument
        title="Terms of Use"
        lastUpdated={LEGAL_LAST_UPDATED}
        body={TERMS_OF_USE}
        related={[{ href: "/terms", label: "Terms of Service" }, { href: "/privacy", label: "Privacy Policy" }]}
      />
      <LandingFooter />
    </main>
  );
}
