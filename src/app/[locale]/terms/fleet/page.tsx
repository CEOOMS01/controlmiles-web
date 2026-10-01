// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/terms/fleet/page.tsx -- Fleet Terms (organizations and
// their drivers), 2026-10-01; before this it only existed in the app.
// Text lives in src/lib/legal-texts.ts, word for word the app's
// lib/legal/legal_documents.dart.

import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { LegalDocument } from "@/components/legal-document";
import { FLEET_TERMS_OF_SERVICE, LEGAL_LAST_UPDATED } from "@/lib/legal-texts";
import "../../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const plexSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata: Metadata = {
  title: "Fleet Terms of Service — ControlMiles",
};

export default function Page() {
  return (
    <main
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <LegalDocument
        title="Fleet Terms of Service"
        lastUpdated={LEGAL_LAST_UPDATED}
        body={FLEET_TERMS_OF_SERVICE}
        related={[{ href: "/terms", label: "Terms of Service" }, { href: "/privacy/fleet", label: "Fleet Privacy Policy" }]}
      />
      <LandingFooter />
    </main>
  );
}
