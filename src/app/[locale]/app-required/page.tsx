// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/app-required/page.tsx
//
// Explicit user requirement (2026-09-09): controlmiles.com is fleet-admin
// only going forward -- everyone else (gig drivers, fleet drivers)
// downloads the mobile app instead. Real bug found and fixed alongside
// this: login/actions.ts used to redirect any non-fleet_admin account
// straight to /portal/generate (the driver report-code flow, now moved
// to the mobile app's Settings screen -- see ControlMiles-app's
// generate_report_code_screen.dart) -- a stale destination that no
// longer matches what the web is for. This page replaces that redirect
// target.
//
// 2026-10-07 (user rule: Basic/Premium are sold only in the app, fleets
// only on the web with Stripe): this is also where the Basic/Premium
// "Start 15-day free trial" buttons on /pricing land, so it is a real
// download page now -- the way Gridwise sells Plus: price on the site,
// button to the store, trial and billing in the app. It used to say "the
// app is coming soon" and "this website is for fleet admins" to people
// who had just picked a plan.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor } from "@/i18n/metadata";
import { Link } from "@/i18n/routing";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.olimsys.controlmiles";
// The app is in closed testing: its Play listing is not public yet, so a
// link would show "item not found". Flip to true when production is live.
const PLAY_STORE_PUBLIC = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "getApp" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/app-required", locale),
  };
}

export default async function AppRequiredPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("getApp");
  const steps = t.raw("steps") as string[];

  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable} flex min-h-screen flex-col`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 sm:px-10">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">{t("eyebrow")}</p>
        <h1 className="display mt-4 text-3xl font-semibold leading-[1.05] sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t("body")}</p>

        <ol className="mt-6 space-y-3 text-sm text-[var(--lg-ink)]">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="mono mt-0.5 text-xs font-semibold text-[var(--lg-blue-deep)]">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          {PLAY_STORE_PUBLIC ? (
            <a
              href={PLAY_STORE_URL}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--lg-blue-deep)" }}
            >
              {t("googlePlay")}
            </a>
          ) : (
            <span className="rounded-full border border-[var(--lg-line)] px-6 py-3 text-sm font-semibold text-[var(--lg-ink-dim)]">
              {t("googlePlaySoon")}
            </span>
          )}
          <span className="rounded-full border border-[var(--lg-line)] px-6 py-3 text-sm font-semibold text-[var(--lg-ink-dim)]">
            {t("appStoreSoon")}
          </span>
        </div>

        <p className="mt-10 text-xs leading-relaxed text-[var(--lg-ink-dim)]">
          {t("fleetNote")}{" "}
          <Link href="/pricing#fleets" className="font-semibold text-[var(--lg-blue-deep)] underline">
            {t("fleetLink")}
          </Link>
        </p>
        <Link href="/" className="mt-3 text-xs text-[var(--lg-ink-dim)] underline">
          {t("back")}
        </Link>
      </div>
      <LandingFooter />
    </main>
  );
}
