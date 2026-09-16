// Olympus Mont Systems LLC - ControlMiles
// src/app/pricing/page.tsx
//
// Explicit user requirement (2026-09-09): add pricing to the web, for
// fleet admins, display-only for now (no real Stripe checkout yet --
// user chose "solo mostrar planes por ahora"). Numbers below are the
// output of a competitive research + cost pass done the same day:
// Gig tiers ($4.99/$9.99) were reviewed against MileIQ ($13.99),
// Everlance ($5-10), Hurdlr ($8.34-16.67) and kept as-is -- already
// undercuts the category while offering odometer-OCR verification +
// hash-chained audit log none of them have, and infra cost (~$200-290/mo
// fixed Supabase+Vercel baseline, ~2.9%+$0.30 Stripe fee per charge)
// clears break-even at a small subscriber floor (~45 Basic / ~22
// Premium), after which margin is standard SaaS-shaped. Fleet tiers are
// new: software-only fleet GPS tracking runs $10-30/vehicle/mo at the
// basic end (as low as $4-6 for stripped-down options) up to $35-65+ for
// full platforms -- ControlMiles Fleet sits mid-market (DVIR,
// geofencing, live map, roster/revocation, audit log, Report Portal)
// without ever selling hardware, so Starter/Growth are priced above the
// cheap-tracker floor but below the enterprise ceiling. All figures are
// ControlMiles' own estimate, not financial or tax advice.

import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor } from "@/i18n/metadata";
import { Link } from "@/i18n/routing";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { Reveal } from "@/components/reveal";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

type Plan = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

const gigPlans = (t: Awaited<ReturnType<typeof getTranslations>>): Plan[] => [
  {
    name: t("plans.basicName"),
    price: "$4.99",
    unit: t("perDriver"),
    tagline: t("plans.basicTagline"),
    features: [
      t("features.gpsCarousel"),
      t("features.perAppTagging"),
      t("features.monthlySummary"),
      t("features.pdfExport"),
    ],
    cta: { label: t("getApp"), href: "/app-required" },
  },
  {
    name: t("plans.premiumName"),
    price: "$9.99",
    unit: t("perDriver"),
    tagline: t("plans.premiumTagline"),
    features: [
      t("features.everythingBasic"),
      t("features.autoDetection"),
      t("features.odometerPhoto"),
      t("features.tamperEvident"),
      t("features.portalCodes"),
      t("features.unlimitedHistory"),
    ],
    cta: { label: t("getApp"), href: "/app-required" },
    highlight: true,
  },
];

const fleetPlans = (t: Awaited<ReturnType<typeof getTranslations>>): Plan[] => [
  {
    name: t("plans.starterName"),
    price: "$12.99",
    unit: t("perVehicle"),
    tagline: t("plans.starterTagline"),
    features: [
      t("features.rosters"),
      t("features.gpsPerDriver"),
      t("features.odometerVerification"),
      t("features.portalAnyDriver"),
      t("features.revocation"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
  },
  {
    name: t("plans.growthName"),
    price: "$19.99",
    unit: t("perVehicle"),
    tagline: t("plans.growthTagline"),
    features: [
      t("features.everythingStarter"),
      t("features.dvir"),
      t("features.geofencing"),
      t("features.assignmentModes"),
      t("features.fleetExport"),
      t("features.activityLog"),
    ],
    cta: { label: t("signInFleet"), href: "/login" },
    highlight: true,
  },
  {
    name: t("plans.enterpriseName"),
    price: t("plans.enterprisePrice"),
    unit: "",
    tagline: t("plans.enterpriseTagline"),
    features: [
      t("features.everythingGrowth"),
      t("features.onboarding"),
      t("features.customReporting"),
      t("features.prioritySupport"),
    ],
    cta: { label: "contact@controlmiles.com", href: "mailto:contact@controlmiles.com" },
  },
];

function PlanCard({ plan, index = 0, mostPopular }: { plan: Plan; index?: number; mostPopular: string }) {
  return (
    // El plan destacado se distingue por su POSICIÓN EN REPOSO (elevado,
    // .plan-featured) además del borde y la sombra que ya tenía. La
    // jerarquía se lee de un vistazo, sin que la tarjeta tenga que estar
    // latiendo: el único movimiento continuo de la página es el destello
    // ocasional de la insignia.
    <Reveal
      index={index}
      className={`lift flex flex-col rounded-2xl border p-7${plan.highlight ? " plan-featured" : ""}`}
      style={{
        borderColor: plan.highlight ? "var(--lg-blue)" : "var(--lg-line)",
        background: "var(--lg-bg-raised)",
        boxShadow: plan.highlight
          ? "0 20px 50px -24px rgba(44,108,153,0.35)"
          : "0 10px 30px -20px rgba(33,28,20,0.3)",
      }}
    >
      {plan.highlight && (
        <p
          className="mono plan-badge mb-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]"
          style={{ background: "rgba(62,147,202,0.12)", color: "var(--lg-blue-deep)" }}
        >
          {mostPopular}
        </p>
      )}
      <h3 className="display text-2xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">{plan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-4xl font-semibold">{plan.price}</span>
        {plan.unit && <span className="text-sm text-[var(--lg-ink-dim)]">{plan.unit}</span>}
      </div>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[var(--lg-ink-dim)]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-0.5" style={{ color: "var(--lg-blue-deep)" }}>
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={plan.cta.href}
        className="mt-7 rounded-full px-5 py-2.5 text-center text-sm font-semibold transition"
        style={
          plan.highlight
            ? { background: "var(--lg-blue-deep)", color: "white" }
            : { border: "1px solid var(--lg-line)", color: "var(--lg-ink)" }
        }
      >
        {plan.cta.label}
      </Link>
    </Reveal>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/pricing", locale),
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");
  const GIG_PLANS = gigPlans(t);
  const FLEET_PLANS = fleetPlans(t);

  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />

      {/* Antes: max-w-4xl + text-center. Eso rompía el eje de la página --
          el resto del contenido (secciones, tarjetas, nav, footer) arranca
          en el mismo borde izquierdo, y este bloque flotaba centrado en un
          contenedor más estrecho, así que al bajar la vista el texto
          saltaba de sitio. Mismo max-w-6xl y misma alineación que todo lo
          demás: una sola columna vertical de lectura. */}
      <section className="mx-auto max-w-6xl px-6 pb-4 pt-12 sm:px-10 sm:pt-16">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
          {t("eyebrow")}
        </p>
        <h1 className="display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--lg-ink-dim)]">
          {t("subtitle")}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-6 sm:px-10">
        <h2 className="display text-2xl font-semibold">{t("forDrivers")}</h2>
        <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">
          {t("forDriversNote")}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {GIG_PLANS.map((p, i) => (
            <PlanCard key={p.name} plan={p} index={i} mostPopular={t("mostPopular")} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <h2 className="display text-2xl font-semibold">{t("forFleets")}</h2>
        <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">
          {t("forFleetsNote")}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {FLEET_PLANS.map((p, i) => (
            <PlanCard key={p.name} plan={p} index={i} mostPopular={t("mostPopular")} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-4 sm:px-10">
        <p className="max-w-2xl text-xs leading-relaxed text-[var(--lg-ink-dim)]">
          {t("disclaimer")}
        </p>
      </section>

      <LandingFooter />
    </main>
  );
}
