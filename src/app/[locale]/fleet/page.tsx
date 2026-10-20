// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/fleet/page.tsx
//
// CMFleet (2026-10-20, user request): one page for everything ControlMiles
// Fleet, pricing included. Same look as the rest of controlmiles.com
// (landing.css, LandingNav/Footer, PlanCard) so it reads as part of the same
// site, with Fleet's black as the accent (user: "it shouldn't look like a
// different page"). Built after a pricing pass on the market (driving school
// software: Software for Driving School $49 / $79 / $399 a month, DriveScout
// $50 per user with a 5-user minimum, Teachworks base + per lesson,
// ZoomScheduler from $49; fleet GPS: Samsara, Motive, Verizon Connect about
// $20-45 per vehicle with 12-36 month contracts and hardware). The
// comparison table only uses those ranges. Plans come from
// src/lib/fleet-plans.ts, the same list /pricing shows.

import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { alternatesFor } from "@/i18n/metadata";
import { Link } from "@/i18n/routing";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { PlanCard } from "@/components/plan-card";
import { Reveal } from "@/components/reveal";
import { fleetPlans, schoolPlans } from "@/lib/fleet-plans";
import "../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

// Fleet's own color: the black of the CMFleet app icon.
const FLEET_BLACK = "#0b0b0b";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cmfleet" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/fleet", locale),
  };
}

const Check = ({ light = false }: { light?: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 16 16"
    className="mt-0.5 h-4 w-4 shrink-0"
    style={{ color: light ? "#ffffff" : "var(--lg-blue-deep)" }}
  >
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICONS = {
  gps: "M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
  odo: "M4 15a8 8 0 1116 0M12 15l4-5M8 19h8",
  insp: "M9 4h6v3H9zM7 6H5v15h14V6h-2M9 13l2 2 4-4",
  reports: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  school: "M4 17h16M6 17V9l6-4 6 4v8M10 17v-4h4v4",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  bus: "M5 4h14v12H5zM5 10h14M8 19v-3M16 19v-3",
  sales: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  pin: "M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
};

export default async function CMFleetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cmfleet");
  const tp = await getTranslations("pricing");
  const SCHOOL = schoolPlans(tp);
  const FLEET = fleetPlans(tp);

  const services = [
    { key: "school", icon: ICONS.school },
    { key: "trucking", icon: ICONS.truck },
    { key: "transport", icon: ICONS.bus },
    { key: "sales", icon: ICONS.sales },
    { key: "general", icon: ICONS.pin },
  ];
  const capabilities = [
    { key: "gps", icon: ICONS.gps },
    { key: "odo", icon: ICONS.odo },
    { key: "insp", icon: ICONS.insp },
    { key: "reports", icon: ICONS.reports },
  ];

  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-10 sm:px-10 md:grid-cols-[1.1fr_0.9fr] md:items-start md:gap-16 md:pt-20">
        <div>
          <p
            className="rise inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-semibold tracking-wide text-white"
            style={{ background: FLEET_BLACK, animationDelay: "0.05s" }}
          >
            <Image src="/cmfleet-logo.png" alt="" width={22} height={22} className="rounded-full ring-1 ring-white/25" />
            CMFleet
          </p>
          <h1
            className="display rise mt-6 text-5xl font-semibold leading-[1.02] sm:text-6xl"
            style={{ animationDelay: "0.15s" }}
          >
            {t("hero.title")}
          </h1>
          <p
            className="rise mt-6 max-w-md text-base leading-relaxed text-[var(--lg-ink-dim)]"
            style={{ animationDelay: "0.3s" }}
          >
            {t("hero.subtitle")}
          </p>
          <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "0.42s" }}>
            <Link
              href="/signup"
              className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: FLEET_BLACK }}
            >
              {t("hero.ctaPrimary")}
            </Link>
            <a
              href="#pricing"
              className="rounded-full border border-[var(--lg-line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--lg-ink)] transition hover:border-[var(--lg-ink)]"
            >
              {t("hero.ctaSecondary")}
            </a>
          </div>
          <p className="rise mt-4 text-xs text-[var(--lg-ink-dim)]" style={{ animationDelay: "0.5s" }}>
            {t("hero.note")}
          </p>
        </div>

        {/* What one account includes (replaces the sample "Today" card). */}
        <div className="rise" style={{ animationDelay: "0.2s" }}>
          <div className="overflow-hidden rounded-2xl border border-[var(--lg-line)] bg-white shadow-[0_20px_50px_-24px_rgba(33,28,20,0.25)]">
            <div className="flex items-center gap-3 px-6 py-4 text-white" style={{ background: FLEET_BLACK }}>
              <Image src="/cmfleet-logo.png" alt="" width={34} height={34} className="rounded-full ring-1 ring-white/25" />
              <p className="text-sm font-semibold leading-snug">{t("card.title")}</p>
            </div>
            <ul className="divide-y divide-[var(--lg-line)]">
              {capabilities.map((c) => (
                <li key={c.key} className="flex gap-4 px-6 py-4">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--lg-bg)", color: FLEET_BLACK }}
                  >
                    <Icon d={c.icon} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t(`card.${c.key}`)}</span>
                    <span className="mt-0.5 block text-sm text-[var(--lg-ink-dim)]">{t(`card.${c.key}Body`)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--lg-line)] bg-[var(--lg-bg)] px-6 py-3 text-xs text-[var(--lg-ink-dim)]">
              {t("card.foot")}
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--lg-line)] bg-[var(--lg-bg-raised)]">
        <dl className="mx-auto grid max-w-6xl divide-y divide-[var(--lg-line)] px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-10">
          {[
            [t("stats.hardwareValue"), t("stats.hardwareLabel")],
            [t("stats.trialValue"), t("stats.trialLabel")],
            [t("stats.contractValue"), t("stats.contractLabel")],
          ].map(([v, l]) => (
            <div key={l} className="py-7 sm:px-8 sm:first:pl-0">
              <dt className="display text-3xl font-semibold">{v}</dt>
              <dd className="mt-1 text-sm text-[var(--lg-ink-dim)]">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">{t("services.eyebrow")}</p>
        <h2 className="display mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">{t("services.title")}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t("services.subtitle")}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {services.map((s, i) => (
            <Reveal
              key={s.key}
              index={i}
              className="lift rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-bg-raised)] p-6"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ background: FLEET_BLACK }}
              >
                <Icon d={s.icon} />
              </span>
              <h3 className="display mt-5 text-lg font-semibold">{t(`services.${s.key}Title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t(`services.${s.key}Body`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--lg-line)] bg-[var(--lg-bg-raised)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">{t("how.eyebrow")}</p>
          <h2 className="display mt-4 text-3xl font-semibold sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="border-t-2 pt-5" style={{ borderColor: FLEET_BLACK }}>
                <span className="mono text-sm text-[var(--lg-ink-dim)]">0{n}</span>
                <h3 className="display mt-2 text-xl font-semibold">{t(`how.step${n}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t(`how.step${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Driving schools */}
      <section id="driving-schools" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 sm:px-10">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">{t("school.eyebrow")}</p>
            <h2 className="display mt-4 text-3xl font-semibold sm:text-4xl">{t("school.title")}</h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t("school.body")}</p>
          </div>
          <ul className="divide-y divide-[var(--lg-line)] rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-bg-raised)]">
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
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-10">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">{t("pricing.eyebrow")}</p>
        <h2 className="display mt-4 text-3xl font-semibold sm:text-4xl">{t("pricing.title")}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t("pricing.subtitle")}</p>

        <h3 className="display mt-12 text-2xl font-semibold">{t("pricing.schoolsTitle")}</h3>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {SCHOOL.map((p, i) => (
            <PlanCard key={p.name} plan={{ ...p, cta: { label: t("hero.ctaPrimary"), href: "/signup" } }} index={i} mostPopular={tp("mostPopular")} />
          ))}
        </div>

        <h3 className="display mt-16 text-2xl font-semibold">{t("pricing.fleetsTitle")}</h3>
        <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">{t("pricing.fleetsNote")}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {FLEET.map((p, i) => (
            <PlanCard key={p.name} plan={{ ...p, cta: { label: t("hero.ctaPrimary"), href: "/signup" } }} index={i} mostPopular={tp("mostPopular")} />
          ))}
        </div>
        <p className="mt-6 text-xs text-[var(--lg-ink-dim)]">{t("pricing.taxNote")}</p>
      </section>

      {/* Comparison: the one dark band, in Fleet black. */}
      <section className="text-white" style={{ background: FLEET_BLACK }}>
        <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <p className="mono text-xs font-medium tracking-[0.2em] text-white/50">{t("compare.eyebrow")}</p>
          <h2 className="display mt-4 text-3xl font-semibold sm:text-4xl">{t("compare.title")}</h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-white/15">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/15">
                  <th scope="col" className="px-5 py-3 font-medium">{t("compare.colItem")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("compare.colTypical")}</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-white">{t("compare.colCm")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[1, 2, 3, 4].map((n) => (
                  <tr key={n}>
                    <th scope="row" className="px-5 py-4 font-medium">{t(`compare.r${n}`)}</th>
                    <td className="px-5 py-4 text-white/60">{t(`compare.r${n}Typical`)}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-start gap-2">
                        <Check light />
                        {t(`compare.r${n}Cm`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-white/50">{t("compare.source")}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10">
        <h2 className="display text-3xl font-semibold">{t("faq.title")}</h2>
        <div className="mt-8 divide-y divide-[var(--lg-line)] border-y border-[var(--lg-line)]">
          {[1, 2, 3, 4, 5].map((n) => (
            <details key={n} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {t(`faq.q${n}`)}
                <span aria-hidden="true" className="text-xl leading-none text-[var(--lg-ink-dim)] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:px-10">
        <div className="flex flex-col items-start gap-6 rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-bg-raised)] p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="display text-3xl font-semibold">{t("cta.title")}</h2>
            <p className="mt-2 text-sm text-[var(--lg-ink-dim)]">{t("cta.body")}</p>
          </div>
          <Link
            href="/signup"
            className="rounded-full px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: FLEET_BLACK }}
          >
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
