// Olympus Mont Systems LLC - ControlMiles
// src/app/[locale]/fleet/enterprise-brief/page.tsx
//
// Pieza de venta privada (pedido explícito, 2026-09-18): NO es una página
// pública -- no tiene enlace en LandingNav/Footer ni en ningún sitemap, solo
// es alcanzable por link directo. Sirve para mostrarle a un prospecto de
// flota Enterprise exactamente qué funciona HOY en producción, no roadmap.
//
// Contenido auditado línea por línea contra el código real (ambos repos,
// mobile + web admin) antes de escribir una sola palabra de marketing --
// cada capacidad listada abajo tiene una llamada RPC/tabla real detrás.
// Deliberadamente NO se listan: invitación por deep-link (el botón que la
// dispara no existe en ningún lado todavía), "filing" de IFTA (solo hay
// millas por estado, no combustible por jurisdicción), alertas de velocidad
// por límite real de vía (es un umbral fijo), ni checkout de facturación
// self-service (la página de precios es solo texto, sin Stripe real
// conectado). Prometer cualquiera de esas cinco cosas frente a un cliente
// sería vender algo que no existe.
//
// Sin next-intl a propósito: es una pieza puntual en inglés para un
// prospecto específico, no contenido público que necesite alternates de
// idioma/hreflang. Vive bajo [locale] solo para heredar el ruteo/build ya
// existente, no para traducirse.

import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import { Reveal } from "@/components/reveal";
import "../../landing.css";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-plex" });

export const metadata = {
  robots: { index: false, follow: false },
  title: "ControlMiles Fleet — Enterprise Brief",
};

type Capability = { title: string; body: string };
type Category = { name: string; items: Capability[] };

const CATEGORIES: Category[] = [
  {
    name: "Roster & driver onboarding",
    items: [
      {
        title: "Live roster, phone or browser",
        body: "Active drivers and pending invites, in sync whether an admin checks from the app or the dashboard.",
      },
      {
        title: "Two working ways to bring a driver on",
        body: "Invite someone who already has a ControlMiles account by email, or hand a brand-new driver a one-time claim code — both create a real, active roster membership.",
      },
      {
        title: "Vehicle assignment, fixed or rotating",
        body: "Tie a driver to one vehicle, or run an open pool where drivers pick an unclaimed vehicle each shift.",
      },
    ],
  },
  {
    name: "Safety & compliance",
    items: [
      {
        title: "DVIR-style pre/post-trip inspections",
        body: "Driver submits a checklist with defect photos; pass/fail is computed server-side, not trusted from the phone. A failed inspection auto-opens a maintenance record.",
      },
      {
        title: "Mid-trip incident reporting",
        body: "A driver can flag something the moment it happens, with full context landing on the admin's Reviews page immediately.",
      },
      {
        title: "Automatic driver safety events",
        body: "Harsh braking, hard acceleration, and speeding are detected from the GPS trail the app is already collecting — no extra hardware, no separate app.",
      },
      {
        title: "Speeding checked against the real posted limit",
        body: "Not a flat cutoff — a speeding flag is confirmed against the actual road's posted speed limit (OpenStreetMap) before it's logged, falling back to a fixed threshold only where a road isn't tagged.",
      },
      {
        title: "Vehicle maintenance history",
        body: "A running log of service records — type, date, odometer, cost, next due — visible on the dashboard.",
      },
    ],
  },
  {
    name: "Live tracking & geofencing",
    items: [
      {
        title: "Real-time fleet map",
        body: "Vehicle positions update live on both the phone and the web dashboard over a real Supabase Realtime channel — not a polling refresh.",
      },
      {
        title: "Geofencing with live alerts",
        body: "Draw a zone around a vehicle from the live map; an alert fires the moment a crossing is detected, pushed to the same real-time channel.",
      },
    ],
  },
  {
    name: "Odometer evidence",
    items: [
      {
        title: "Weekly odometer checkpoints",
        body: "One low-friction photo prompt a week instead of one every trip. A reading can never be entered below what's already on file — enforced server-side, not just in the app's UI.",
      },
      {
        title: "A vehicle record that stays current",
        body: "Every accepted checkpoint updates the vehicle's odometer on file, so it's never stale from the day it was first registered.",
      },
    ],
  },
  {
    name: "Reporting & export",
    items: [
      {
        title: "State-by-state mileage breakdown",
        body: "Computed server-side from real GPS trail data, filterable by vehicle and date range — built for IFTA mileage prep.",
      },
      {
        title: "Real CSV and PDF fleet export",
        body: "A working, paginated PDF rollup (not a stub) and a real CSV — per-driver totals for a date range, ready to hand to an accountant.",
      },
      {
        title: "Dispatch & route tracking",
        body: "Create, assign, and close routes with a real status lifecycle, plus a cycle-time chart computed from actual open/close timestamps.",
      },
    ],
  },
  {
    name: "Administration",
    items: [
      {
        title: "Multi-organization support",
        body: "An owner running more than one fleet can switch between organizations from one dashboard login.",
      },
      {
        title: "Full organization lifecycle",
        body: "Create, rename, and delete an organization — deletion is a real, atomic operation that preserves driver mileage history even after the org is gone.",
      },
      {
        title: "Personal ⇄ Fleet mode switching",
        body: "A hybrid user who drives personally and also runs a fleet switches modes in-app, server-validated either way.",
      },
    ],
  },
];

export default function EnterpriseBriefPage() {
  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />

      <section className="mx-auto max-w-6xl px-6 pb-4 pt-12 sm:px-10 sm:pt-16">
        <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
          CONTROLMILES FLEET
        </p>
        <h1 className="display mt-4 text-4xl font-semibold leading-[1.05] sm:text-5xl">
          What&apos;s live today, not on a roadmap.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--lg-ink-dim)]">
          Every capability below is running in production right now — real GPS trip
          tracking, real DVIR inspections, a real live map. Nothing here is a mockup or a
          &quot;coming soon.&quot;
        </p>
      </section>

      {CATEGORIES.map((cat, catIndex) => (
        <section key={cat.name} className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
          <h2 className="display text-2xl font-semibold">{cat.name}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {cat.items.map((item, i) => (
              <Reveal
                key={item.title}
                index={catIndex * 2 + i}
                className="lift rounded-xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
              >
                <h3 className="display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
                  {item.body}
                </p>
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      <section className="border-y border-[var(--lg-line)] bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
            THE ENTERPRISE COMBO
          </p>
          <h2 className="display mt-3 max-w-2xl text-3xl font-semibold leading-[1.05] sm:text-4xl">
            Everything above, plus what a larger fleet actually needs to roll out.
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Reveal
              index={0}
              className="lift rounded-xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
            >
              <h3 className="display text-lg font-semibold">Guided onboarding</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
                We set up the roster, vehicles, and assignment mode with you — your fleet
                is tracking on day one, not week three.
              </p>
            </Reveal>
            <Reveal
              index={1}
              className="lift rounded-xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
            >
              <h3 className="display text-lg font-semibold">Custom reporting</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
                The CSV/PDF export and state-mileage breakdown are built to your finance
                or compliance team&apos;s exact format, not a one-size-fits-all template.
              </p>
            </Reveal>
            <Reveal
              index={2}
              className="lift rounded-xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
            >
              <h3 className="display text-lg font-semibold">Priority support</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
                A direct line, not a ticket queue, for anything blocking your fleet from
                tracking.
              </p>
            </Reveal>
            <Reveal
              index={3}
              className="lift rounded-xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
            >
              <h3 className="display text-lg font-semibold">Multi-organization ready</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
                Running more than one operating entity or region? Switch between them from
                one login, one dashboard.
              </p>
            </Reveal>
          </div>
          <a
            href="mailto:contact@controlmiles.com"
            className="mt-10 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--lg-blue-deep)" }}
          >
            contact@controlmiles.com
          </a>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
