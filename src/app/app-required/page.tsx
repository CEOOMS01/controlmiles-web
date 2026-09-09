// Olympus Mont Systems LLC - ControlMiles
// src/app/app-required/page.tsx
//
// Explicit user requirement (2026-09-09): controlmiles.com is fleet-admin
// only going forward -- everyone else (gig drivers, fleet drivers)
// downloads the mobile app instead. Real bug found and fixed alongside
// this: login/actions.ts used to redirect any non-fleet_admin account
// straight to /portal/generate (the driver report-code flow, now moved
// to the mobile app's Settings screen -- see ControlMiles-app's
// generate_report_code_screen.dart) -- a stale destination that no
// longer matches what the web is for. This page replaces that redirect
// target: a clear dead end telling a non-admin exactly where to go
// instead, rather than dropping them on a page whose whole reason to
// exist just moved elsewhere.

import Link from "next/link";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export default function AppRequiredPage() {
  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable} flex min-h-screen flex-col`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
          CONTROLMILES.COM IS FOR FLEET ADMINS
        </p>
        <h1 className="display mt-4 text-3xl font-semibold leading-[1.05] sm:text-4xl">
          Get the ControlMiles app instead
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
          Trip tracking, odometer capture, reports, and your Report Portal
          access code all live in the ControlMiles mobile app now. This
          website is for fleet administrators managing a roster of
          drivers and vehicles.
        </p>
        <p className="mt-6 text-sm font-medium text-[var(--lg-ink)]">
          The app is coming soon to Google Play and the App Store.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full border border-[var(--lg-line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--lg-ink)] transition hover:border-[var(--lg-blue)]"
        >
          Back to controlmiles.com
        </Link>
      </div>
      <LandingFooter />
    </main>
  );
}
