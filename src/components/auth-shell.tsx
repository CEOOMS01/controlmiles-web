// Split-screen shell for sign-in / sign-up (redesign 2026-09-29, explicit
// user request: "más fluido, menos soso"). Researched first (Authgear 2025
// login/sign-up guide, Eleken SaaS login examples): a brand panel that
// says what you're signing into, next to a short focused form; on phones
// the panel collapses to a compact brand header so the form stays first.
// The panel reuses the website hero's navy + route-curve motif.

import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";

const POINTS = [
  "Live fleet map, geofences and DVIR inspections",
  "Every trip GPS-logged and locked the moment it's saved",
  "IFTA state mileage and one-click fleet exports",
];

function RouteCurve({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" fill="none" className={className} aria-hidden="true">
      <path
        d="M-20 170 C 120 40, 220 210, 360 110 S 540 60, 620 90"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="360" cy="110" r="8" fill="currentColor" />
    </svg>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen w-full flex-1 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0f2a44] to-[#1f5f8b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <RouteCurve className="pointer-events-none absolute top-24 left-0 w-full text-white/10" />
        <div className="relative flex items-center gap-3">
          <Image src="/logo_controlmiles.png" alt="" width={40} height={40} className="rounded-lg" priority />
          <span className="text-lg font-semibold tracking-tight">ControlMiles</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">
            Every mile,
            <br />
            <span className="text-[#9cc9ea]">on the record.</span>
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9cc9ea]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} ControlMiles · Powered by Olimsys</p>
      </aside>

      <section className="relative flex items-center justify-center px-4 py-16 sm:px-8">
        <Link
          href="/"
          className="absolute top-4 right-4 rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-foreground sm:top-6 sm:right-6"
        >
          ← Back to site
        </Link>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Image
              src="/logo_controlmiles.png"
              alt="ControlMiles"
              width={48}
              height={48}
              className="mb-6 rounded-xl lg:hidden"
              priority
            />
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
