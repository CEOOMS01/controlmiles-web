// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/fleet/page.tsx
//
// CMFleet (2026-10-20, user request): one page for everything ControlMiles
// Fleet, pricing included, in Fleet's black. Built after a pricing pass on
// the market (driving school software: Software for Driving School $49 /
// $79 / $399 a month, DriveScout $50 per user with a 5-user minimum,
// Teachworks base + per lesson, ZoomScheduler from $49; fleet GPS: Samsara,
// Motive, Verizon Connect about $20-45 per vehicle with 12-36 month
// contracts and hardware). The comparison table only uses those ranges.
// Plans come from src/lib/fleet-plans.ts, the same list /pricing shows, and
// every bullet maps to a feature that plan really has (fn_org_features).

import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { alternatesFor } from "@/i18n/metadata";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";
import { fleetPlans, schoolPlans, type Plan } from "@/lib/fleet-plans";
import "./fleet.css";

const sans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-cf-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cmfleet" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/fleet", locale),
  };
}

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--cf-blue)" }}>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function FleetMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/cmfleet-logo.png"
      alt=""
      width={size}
      height={size}
      className="rounded-full ring-1 ring-white/20"
      priority
    />
  );
}

export default async function CMFleetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cmfleet");
  const tp = await getTranslations("pricing");
  const tn = await getTranslations("nav");
  const SCHOOL = schoolPlans(tp);
  const FLEET = fleetPlans(tp);

  const services = [
    { title: t("services.schoolTitle"), body: t("services.schoolBody"), icon: "M4 17h16M6 17V9l6-4 6 4v8M10 17v-4h4v4" },
    { title: t("services.truckingTitle"), body: t("services.truckingBody"), icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z" },
    { title: t("services.transportTitle"), body: t("services.transportBody"), icon: "M5 4h14v12H5zM5 10h14M8 19v-3M16 19v-3" },
    { title: t("services.salesTitle"), body: t("services.salesBody"), icon: "M4 19V9M10 19V5M16 19v-7M22 19H2" },
    { title: t("services.generalTitle"), body: t("services.generalBody"), icon: "M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z" },
  ];

  return (
    <main
      className={`cmfleet ${sans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-cf-sans), system-ui, sans-serif" }}
    >
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-[var(--cf-line)] bg-[var(--cf-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-8">
          <Link href="/fleet" className="flex items-center gap-2.5">
            <FleetMark />
            <span className="text-lg font-semibold tracking-tight">CMFleet</span>
            <span className="hidden text-xs text-[var(--cf-faint)] sm:inline">by ControlMiles</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <a href="#pricing" className="hidden px-2 text-[var(--cf-dim)] hover:text-[var(--cf-ink)] sm:inline">
              {tn("pricing")}
            </a>
            <span className="cf-lang hidden sm:inline">
              <LanguageSwitcher label={tn("languageLabel")} />
            </span>
            <Link href="/login" className="cf-btn-ghost rounded-full px-4 py-2 font-medium">
              {t("cta.signIn")}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="cf-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
          <div>
            <p className="cf-eyebrow cf-rise">{t("hero.eyebrow")}</p>
            <h1
              className="cf-rise mt-5 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl"
              style={{ ["--cf-delay" as string]: "0.05s" }}
            >
              {t("hero.title")}
            </h1>
            <p
              className="cf-rise mt-6 max-w-xl text-base leading-relaxed text-[var(--cf-dim)] sm:text-lg"
              style={{ ["--cf-delay" as string]: "0.1s" }}
            >
              {t("hero.subtitle")}
            </p>
            <div className="cf-rise mt-8 flex flex-wrap gap-3" style={{ ["--cf-delay" as string]: "0.15s" }}>
              <Link href="/signup" className="cf-btn-primary rounded-full px-6 py-3 text-sm font-semibold">
                {t("hero.ctaPrimary")}
              </Link>
              <a href="#pricing" className="cf-btn-ghost rounded-full px-6 py-3 text-sm font-semibold">
                {t("hero.ctaSecondary")}
              </a>
            </div>
            <p className="cf-rise mt-4 text-xs text-[var(--cf-faint)]" style={{ ["--cf-delay" as string]: "0.2s" }}>
              {t("hero.note")}
            </p>
          </div>

          {/* Product preview (illustrative, labelled as a sample). */}
          <div className="cf-rise" style={{ ["--cf-delay" as string]: "0.2s" }}>
            <div className="cf-card overflow-hidden shadow-[0_40px_120px_-40px_rgba(255,255,255,0.12)]">
              <div className="flex items-center justify-between border-b border-[var(--cf-line)] px-5 py-3">
                <span className="text-sm font-semibold">{t("preview.title")}</span>
                <span className="mono text-[10px] tracking-widest text-[var(--cf-faint)] uppercase">
                  {t("preview.sample")}
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[var(--cf-line)] border-b border-[var(--cf-line)]">
                {[
                  [t("preview.lessons"), "12"],
                  [t("preview.hours"), "41.5"],
                  [t("preview.live"), "4"],
                ].map(([label, value]) => (
                  <div key={label} className="px-5 py-4">
                    <p className="text-[11px] text-[var(--cf-faint)]">{label}</p>
                    <p className="mono mt-1 text-2xl font-medium">{value}</p>
                  </div>
                ))}
              </div>
              <svg viewBox="0 0 400 150" className="block h-40 w-full" aria-hidden="true">
                <defs>
                  <pattern id="cf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.05)" />
                  </pattern>
                </defs>
                <rect width="400" height="150" fill="url(#cf-grid)" />
                <path
                  d="M20 120 C 80 120, 90 40, 160 50 S 250 125, 300 90 S 360 30, 385 35"
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="20" cy="120" r="5" fill="#0a0a0a" stroke="#fafafa" strokeWidth="2" />
                <circle cx="385" cy="35" r="6" fill="var(--cf-blue)" />
                <circle cx="385" cy="35" r="12" fill="none" stroke="var(--cf-blue)" strokeOpacity="0.4" />
              </svg>
              <ul className="divide-y divide-[var(--cf-line)] border-t border-[var(--cf-line)] text-sm">
                {[t("preview.trip"), t("preview.odometer")].map((x) => (
                  <li key={x} className="flex items-center gap-3 px-5 py-3">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--cf-green)" }} />
                    <span className="text-[var(--cf-dim)]">{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="border-y border-[var(--cf-line)]">
          <dl className="mx-auto grid max-w-6xl divide-y divide-[var(--cf-line)] px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
            {[
              [t("stats.hardwareValue"), t("stats.hardwareLabel")],
              [t("stats.trialValue"), t("stats.trialLabel")],
              [t("stats.contractValue"), t("stats.contractLabel")],
            ].map(([v, l]) => (
              <div key={l} className="py-6 sm:px-6 first:sm:pl-0">
                <dt className="mono text-2xl font-medium">{v}</dt>
                <dd className="mt-1 text-sm text-[var(--cf-dim)]">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <p className="cf-eyebrow">{t("services.eyebrow")}</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("services.title")}</h2>
        <p className="mt-3 max-w-xl text-[var(--cf-dim)]">{t("services.subtitle")}</p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--cf-line)] bg-[var(--cf-line)] sm:grid-cols-2 lg:grid-cols-5">
          {services.map((s) => (
            <div key={s.title} className="bg-[var(--cf-raised)] p-6">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path d={s.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cf-dim)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--cf-line)] bg-[var(--cf-raised)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <p className="cf-eyebrow">{t("how.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="border-t border-[var(--cf-line-strong)] pt-5">
                <span className="mono text-sm text-[var(--cf-faint)]">0{n}</span>
                <h3 className="mt-3 text-lg font-semibold">{t(`how.step${n}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--cf-dim)]">{t(`how.step${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Driving schools */}
      <section id="driving-schools" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="cf-eyebrow">{t("school.eyebrow")}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("school.title")}</h2>
            <p className="mt-4 leading-relaxed text-[var(--cf-dim)]">{t("school.body")}</p>
          </div>
          <ul className="cf-card divide-y divide-[var(--cf-line)]">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <li key={n} className="flex gap-3 px-5 py-3.5 text-sm">
                <Check />
                <span>{t(`school.b${n}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t border-[var(--cf-line)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <p className="cf-eyebrow">{t("pricing.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("pricing.title")}</h2>
          <p className="mt-3 max-w-2xl text-[var(--cf-dim)]">{t("pricing.subtitle")}</p>

          <h3 className="mt-12 text-xl font-semibold">{t("pricing.schoolsTitle")}</h3>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {SCHOOL.map((p) => (
              <PlanCard key={p.name} plan={p} popular={tp("mostPopular")} cta={t("hero.ctaPrimary")} />
            ))}
          </div>

          <h3 className="mt-14 text-xl font-semibold">{t("pricing.fleetsTitle")}</h3>
          <p className="mt-1 text-sm text-[var(--cf-dim)]">{t("pricing.fleetsNote")}</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {FLEET.map((p) => (
              <PlanCard key={p.name} plan={p} popular={tp("mostPopular")} cta={t("hero.ctaPrimary")} />
            ))}
          </div>
          <p className="mt-6 text-xs text-[var(--cf-faint)]">{t("pricing.taxNote")}</p>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-[var(--cf-line)] bg-[var(--cf-raised)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <p className="cf-eyebrow">{t("compare.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("compare.title")}</h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--cf-line)]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-[var(--cf-bg)] text-[var(--cf-faint)]">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">{t("compare.colItem")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("compare.colTypical")}</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-[var(--cf-ink)]">{t("compare.colCm")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--cf-line)]">
                {[1, 2, 3, 4].map((n) => (
                  <tr key={n}>
                    <th scope="row" className="px-5 py-4 font-medium">{t(`compare.r${n}`)}</th>
                    <td className="px-5 py-4 text-[var(--cf-dim)]">{t(`compare.r${n}Typical`)}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-start gap-2">
                        <Check />
                        {t(`compare.r${n}Cm`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[var(--cf-faint)]">{t("compare.source")}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">{t("faq.title")}</h2>
        <div className="mt-8 divide-y divide-[var(--cf-line)] border-y border-[var(--cf-line)]">
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
                {t(`faq.q${n}`)}
                <span aria-hidden="true" className="cf-faq-icon text-xl leading-none text-[var(--cf-faint)]">
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--cf-dim)]">{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--cf-line)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("cta.title")}</h2>
            <p className="mt-2 text-[var(--cf-dim)]">{t("cta.body")}</p>
          </div>
          <Link href="/signup" className="cf-btn-primary rounded-full px-7 py-3.5 text-sm font-semibold">
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--cf-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-[var(--cf-faint)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <FleetMark size={20} />
            CMFleet · ControlMiles
          </span>
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-[var(--cf-ink)]">ControlMiles</Link>
            <Link href="/privacy/fleet" className="hover:text-[var(--cf-ink)]">Privacy</Link>
            <Link href="/terms/fleet" className="hover:text-[var(--cf-ink)]">Terms</Link>
            <a href="mailto:support@controlmiles.com" className="hover:text-[var(--cf-ink)]">support@controlmiles.com</a>
          </span>
        </div>
      </footer>
    </main>
  );
}

function PlanCard({ plan, popular, cta }: { plan: Plan; popular: string; cta: string }) {
  return (
    <div className={`cf-card flex flex-col p-6 ${plan.highlight ? "cf-plan-featured" : ""}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">{plan.name}</h4>
        {plan.highlight && (
          <span className="mono rounded-full border border-[var(--cf-line-strong)] px-2.5 py-0.5 text-[10px] tracking-widest">
            {popular}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--cf-dim)]">{plan.tagline}</p>
      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="mono text-4xl font-medium">{plan.price}</span>
        <span className="text-sm text-[var(--cf-faint)]">{plan.unit}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check />
            <span className="text-[var(--cf-dim)]">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-7 rounded-full px-5 py-2.5 text-center text-sm font-semibold ${
          plan.highlight ? "cf-btn-primary" : "cf-btn-ghost"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
