"use client";

// Olympus Mont Systems LLC - ControlMiles Web
// src/components/service-tabs.tsx
//
// "Pick the service your fleet runs" on /fleet: the cards are tabs, and the
// selected one opens a presentation panel below (what the service includes and
// a way in). Text comes from messages (cmfleet.detail.<key>); the page passes
// it in already translated so this stays a small client component.

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";

export type ServiceTab = {
  key: string;
  icon: string;
  /** The service's own icon (public/service-*.png); the line icon is the fallback. */
  image?: string;
  title: string;
  body: string;
  intro: string;
  features: string[];
};

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ServiceTabs({
  services,
  planNote,
  cta,
  ctaHref,
}: {
  services: ServiceTab[];
  planNote: string;
  cta: string;
  ctaHref: string;
}) {
  const [active, setActive] = useState(services[0]?.key ?? "");
  const current = services.find((s) => s.key === active) ?? services[0];
  if (!current) return null;

  return (
    <div>
      <div role="tablist" aria-orientation="horizontal" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {services.map((s) => {
          const on = s.key === current.key;
          return (
            <button
              key={s.key}
              id={`svc-tab-${s.key}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="svc-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(s.key)}
              onKeyDown={(e) => {
                const i = services.findIndex((x) => x.key === s.key);
                const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
                if (next == null) return;
                const t = services[(next + services.length) % services.length];
                setActive(t.key);
                document.getElementById(`svc-tab-${t.key}`)?.focus();
              }}
              className="lift flex flex-col items-start justify-start rounded-2xl border bg-[var(--lg-bg-raised)] p-6 text-left transition"
              style={{ borderColor: on ? "var(--lg-ink)" : "var(--lg-line)", boxShadow: on ? "0 12px 30px -18px rgba(0,0,0,0.5)" : undefined }}
            >
              {s.image ? (
                <Image src={s.image} alt="" width={56} height={56} className="h-14 w-14" />
              ) : (
                <span className="cf-metal flex h-14 w-14 items-center justify-center rounded-full text-white">
                  <Icon d={s.icon} />
                </span>
              )}
              <h3 className="display mt-5 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{s.body}</p>
            </button>
          );
        })}
      </div>

      <div
        id="svc-panel"
        role="tabpanel"
        aria-labelledby={`svc-tab-${current.key}`}
        className="mt-6 grid gap-8 rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-bg-raised)] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]"
      >
        <div className="cf-metal flex min-h-48 flex-col justify-between rounded-xl p-6 text-white">
          {current.image ? (
            <Image src={current.image} alt="" width={96} height={96} className="h-24 w-24" />
          ) : (
            <Icon d={current.icon} className="h-10 w-10" />
          )}
          <div>
            <p className="display text-2xl font-semibold">{current.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{current.intro}</p>
          </div>
        </div>
        <div className="flex flex-col">
          <ul className="space-y-3 text-sm">
            {current.features.map((f) => (
              <li key={f} className="flex gap-3">
                <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--lg-blue-deep)" }}>
                  <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-[var(--lg-ink-dim)]">{planNote}</p>
          <Link
            href={ctaHref}
            className="cf-metal cf-metal-btn mt-6 w-fit rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
