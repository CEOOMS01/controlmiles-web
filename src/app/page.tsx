import Link from "next/link";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { LandingNav, LandingFooter } from "@/components/landing-chrome";
import "./landing.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-plex",
});

const ROUTE_D = "M 8 210 C 120 210, 140 60, 260 60 S 420 210, 520 150 S 640 40, 740 90";

export default function Home() {
  return (
    <main
      className={`landing ${display.variable} ${body.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <LandingNav />
      <Hero />
      <StatsStrip />
      <Features />
      <HowItWorks />
      <PortalCta />
      <LandingFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-10 sm:px-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-20">
      <div>
        <p
          className="rise mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]"
          style={{ animationDelay: "0.05s" }}
        >
          GIG &amp; FLEET MILEAGE, LOGGED
        </p>
        <h1
          className="display rise mt-5 text-5xl leading-[1.02] font-semibold sm:text-6xl md:text-[4.2rem]"
          style={{ animationDelay: "0.15s" }}
        >
          Every mile,
          <br />
          <span className="italic" style={{ color: "var(--lg-blue-deep)" }}>
            on the record.
          </span>
        </h1>
        <p
          className="rise mt-6 max-w-md text-base leading-relaxed text-[var(--lg-ink-dim)]"
          style={{ animationDelay: "0.3s" }}
        >
          GPS trip tracking, odometer verification, and a tamper-evident
          audit trail — built for gig drivers running Uber, DoorDash,
          Instacart and more, and for the fleets managing them.
        </p>
        <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "0.42s" }}>
          <Link
            href="/login"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(44,108,153,0.55)] transition hover:opacity-90"
            style={{ background: "var(--lg-blue-deep)" }}
          >
            Fleet admin sign in
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-[var(--lg-line)] bg-white px-6 py-3 text-sm font-semibold text-[var(--lg-ink)] transition hover:border-[var(--lg-blue)]"
          >
            See pricing
          </Link>
        </div>
      </div>

      <div className="rise" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-2xl border border-[var(--lg-line)] bg-white p-6 shadow-[0_20px_50px_-24px_rgba(33,28,20,0.25)]">
          <div className="flex items-center justify-between">
            <p className="mono text-[11px] font-medium tracking-[0.15em] text-[var(--lg-ink-dim)]">
              TODAY&apos;S ROUTE
            </p>
            <p className="mono text-[11px] font-medium tracking-[0.15em] text-[var(--lg-blue-deep)]">
              VERIFIED
            </p>
          </div>
          <svg viewBox="0 0 760 240" className="mt-4 w-full" role="img" aria-label="An animated route line">
            <path d={ROUTE_D} fill="none" stroke="var(--lg-line)" strokeWidth="2" />
            <path
              className="route-path"
              d={ROUTE_D}
              fill="none"
              stroke="var(--lg-ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle className="route-dot" r="6" fill="var(--lg-blue-deep)" />
          </svg>
          <div className="mt-2 grid grid-cols-3 divide-x divide-[var(--lg-line)] border-t border-[var(--lg-line)] pt-4">
            <div>
              <p className="display text-2xl font-semibold">18.4</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">miles</p>
            </div>
            <div className="pl-4">
              <p className="display text-2xl font-semibold">3</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">trips</p>
            </div>
            <div className="pl-4">
              <p className="display text-2xl font-semibold">$0</p>
              <p className="text-xs text-[var(--lg-ink-dim)]">guesswork</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const stats = [
    { value: "10", unit: "languages", label: "Every driver reads their own" },
    { value: "51", unit: "states mapped", label: "Real boundary data for IFTA mileage" },
    { value: "0", unit: "guesswork", label: "Every trip is GPS-logged, hash-chained" },
  ];
  return (
    <section className="border-y border-[var(--lg-line)] bg-white/60">
      <div className="mx-auto grid max-w-6xl divide-y divide-[var(--lg-line)] px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-10">
        {stats.map((s) => (
          <div key={s.label} className="py-8 sm:px-8">
            <div className="flex items-baseline gap-2">
              <p className="mono display text-4xl leading-none font-semibold" style={{ color: "var(--lg-blue-deep)" }}>
                {s.value}
              </p>
              <p className="text-sm leading-tight text-[var(--lg-ink-dim)]">{s.unit}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "GPS trip tracking",
    body: "Background location tracking through every gig-app switch, with client-side jump/speed/mock-location checks flagging anything that doesn't look real.",
  },
  {
    title: "Odometer, verified",
    body: "Snap a photo at start and end — on-device OCR reads the number, so the mileage claim has a paper trail, not just a GPS estimate.",
  },
  {
    title: "Tamper-evident log",
    body: "Every trip event is written into a SHA-256 hash chain. Edit one record after the fact, and the chain shows exactly where it broke.",
  },
  {
    title: "Fleet, from one dashboard",
    body: "Roster, vehicle assignment, DVIR inspections, live location and geofence alerts — one place for an admin to see the whole fleet.",
  },
];

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
        WHAT&apos;S UNDER THE HOOD
      </p>
      <h2 className="display mt-3 max-w-lg text-4xl font-semibold leading-[1.05] sm:text-5xl">
        Built to survive an audit, not just a glance.
      </h2>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-[var(--lg-line)] bg-white p-7 shadow-[0_10px_30px_-20px_rgba(33,28,20,0.3)]"
          >
            <h3 className="display text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Drive", body: "The app tracks miles per gig app automatically, purpose and all." },
  { n: "02", title: "Review", body: "Every trip, purpose, and mile shows up in your history and PDF reports." },
  { n: "03", title: "Prove it", body: "Share a one-time code — a preparer verifies your report, no account needed." },
];

function HowItWorks() {
  return (
    <section className="border-y border-[var(--lg-line)] bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <h2 className="display text-3xl font-semibold sm:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="mono text-3xl font-medium" style={{ color: "var(--lg-blue-deep)" }}>
                {s.n}
              </p>
              <h3 className="display mt-2 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lg-ink-dim)]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
      <div className="grid gap-8 rounded-2xl border border-[var(--lg-line)] bg-white p-8 shadow-[0_20px_50px_-30px_rgba(33,28,20,0.35)] sm:grid-cols-2 sm:p-12">
        <div>
          <p className="mono text-xs font-medium tracking-[0.2em] text-[var(--lg-amber)]">
            REPORT PORTAL
          </p>
          <h2 className="display mt-3 text-3xl font-semibold leading-[1.05] sm:text-4xl">
            Preparing someone&apos;s taxes?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--lg-ink-dim)]">
            Your client generates a one-time access code from their
            ControlMiles account. Enter it here to view a read-only
            mileage summary — no login, no account, nothing installed.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Link
            href="/portal/verify"
            className="rounded-full px-6 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--lg-amber)" }}
          >
            Enter access code
          </Link>
          <p className="text-center text-xs text-[var(--lg-ink-dim)]">
            For deduction purposes — not guaranteed by this app.
          </p>
        </div>
      </div>
    </section>
  );
}
