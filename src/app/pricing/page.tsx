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

import Link from "next/link";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
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

const GIG_PLANS: Plan[] = [
  {
    name: "Basic",
    price: "$4.99",
    unit: "/ driver / month",
    tagline: "Mileage, logged and ready.",
    features: [
      "GPS trip tracking, start/stop from the gig-app carousel",
      "Per-gig-app trip tagging",
      "Monthly mileage summary",
      "PDF export",
    ],
    cta: { label: "Get the app", href: "/app-required" },
  },
  {
    name: "Premium",
    price: "$9.99",
    unit: "/ driver / month",
    tagline: "Everything a real audit can lean on.",
    features: [
      "Everything in Basic",
      "Automatic trip detection (auto-start, no tapping in)",
      "Odometer photo + on-device OCR verification",
      "SHA-256 hash-chained trip log",
      "Report Portal access codes (no login needed to verify)",
      "Unlimited report history",
    ],
    cta: { label: "Get the app", href: "/app-required" },
    highlight: true,
  },
];

const FLEET_PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$12.99",
    unit: "/ vehicle / month",
    tagline: "Get a fleet on the record.",
    features: [
      "Driver roster & vehicle roster",
      "GPS trip tracking per driver",
      "Odometer photo verification",
      "Report Portal for any driver",
      "Membership revocation",
    ],
    cta: { label: "Sign in as fleet admin", href: "/login" },
  },
  {
    name: "Growth",
    price: "$19.99",
    unit: "/ vehicle / month",
    tagline: "Run the whole fleet from one dashboard.",
    features: [
      "Everything in Starter",
      "DVIR inspections",
      "Geofencing & live map",
      "Fixed or open vehicle assignment",
      "Fleet-wide CSV/PDF export",
      "Full hash-chained audit log",
    ],
    cta: { label: "Sign in as fleet admin", href: "/login" },
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Contact us",
    unit: "",
    tagline: "Custom rollout for larger fleets.",
    features: [
      "Everything in Growth",
      "Dedicated onboarding",
      "Custom reporting & integrations",
      "Priority support",
    ],
    cta: { label: "contact@controlmiles.com", href: "mailto:contact@controlmiles.com" },
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-7"
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
          className="mono mb-3 w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]"
          style={{ background: "rgba(62,147,202,0.12)", color: "var(--lg-blue-deep)" }}
        >
          MOST POPULAR
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
    </div>
  );
}

export default function PricingPage() {
  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />

      <section className="mx-auto max-w-4xl px-6 pb-4 pt-10 text-center sm:px-10 sm:pt-16">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
          PRICING
        </p>
        <h1 className="display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">
          Simple pricing, either way you drive.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--lg-ink-dim)]">
          Individual gig drivers subscribe from the app. Fleet admins manage
          billing and rostering from this dashboard.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-6 sm:px-10">
        <h2 className="display text-2xl font-semibold">For gig drivers</h2>
        <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">
          Billed in-app on the App Store or Google Play. Cancel anytime.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {GIG_PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <h2 className="display text-2xl font-semibold">For fleets</h2>
        <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">
          Priced per vehicle. Set up and manage entirely from controlmiles.com.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {FLEET_PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-4 sm:px-10">
        <p className="text-center text-xs leading-relaxed text-[var(--lg-ink-dim)]">
          Prices shown are current estimates and subject to change before
          checkout is enabled. Not tax or financial advice.
        </p>
      </section>

      <LandingFooter />
    </main>
  );
}
