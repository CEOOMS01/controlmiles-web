import Link from "next/link";
import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./landing.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});
const plexSans = IBM_Plex_Sans({
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
      className={`landing ${display.variable} ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: "var(--font-plex-sans), system-ui, sans-serif" }}
    >
      <Nav />
      <Hero />
      <StatsStrip />
      <Features />
      <HowItWorks />
      <PortalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <span className="display text-xl font-bold tracking-widest">
        CONTROL<span style={{ color: "var(--lg-blue)" }}>MILES</span>
      </span>
      <nav className="flex items-center gap-5 text-sm text-[var(--lg-ink-dim)]">
        <Link href="/portal/verify" className="hidden transition hover:text-[var(--lg-ink)] sm:inline">
          Verify a report
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink)] transition hover:border-[var(--lg-blue)]"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-8 sm:px-10 md:grid-cols-2 md:items-center md:pt-16">
      <div>
        <p
          className="rise mono text-xs tracking-[0.25em]"
          style={{ color: "var(--lg-amber)", animationDelay: "0.05s" }}
        >
          GIG &amp; FLEET MILEAGE, TRACKED
        </p>
        <h1
          className="display rise mt-4 text-[15vw] font-extrabold leading-[0.85] sm:text-6xl md:text-7xl"
          style={{ animationDelay: "0.15s" }}
        >
          Every mile,
          <br />
          <span style={{ color: "var(--lg-blue)" }}>on the record.</span>
        </h1>
        <p
          className="rise mt-6 max-w-md text-base text-[var(--lg-ink-dim)]"
          style={{ animationDelay: "0.3s" }}
        >
          GPS trip tracking, odometer verification, and a tamper-evident
          audit trail — built for gig drivers running Uber, DoorDash,
          Instacart and more, and for fleets managing them.
        </p>
        <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "0.42s" }}>
          <Link
            href="/login"
            className="rounded-full px-6 py-3 text-sm font-semibold text-[#0a0c11] transition hover:opacity-90"
            style={{ background: "var(--lg-blue)" }}
          >
            Driver sign in
          </Link>
          <Link
            href="/portal/verify"
            className="rounded-full border border-[var(--lg-line)] px-6 py-3 text-sm font-semibold text-[var(--lg-ink)] transition hover:border-[var(--lg-blue)]"
          >
            Verify a report
          </Link>
        </div>
      </div>

      <div className="relative">
        <svg viewBox="0 0 760 240" className="w-full" role="img" aria-label="An animated route line">
          <path
            d={ROUTE_D}
            fill="none"
            stroke="var(--lg-line)"
            strokeWidth="2"
          />
          <path
            className="route-path"
            d={ROUTE_D}
            fill="none"
            stroke="var(--lg-blue)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle className="route-dot" r="7" fill="var(--lg-amber)" />
        </svg>
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
    <section className="border-y border-[var(--lg-line)]">
      <div className="mx-auto grid max-w-6xl divide-y divide-[var(--lg-line)] px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-10">
        {stats.map((s) => (
          <div key={s.label} className="py-8 sm:px-8">
            <p className="mono display text-4xl font-bold" style={{ color: "var(--lg-blue)" }}>
              {s.value}
              <span className="ml-2 text-sm font-normal tracking-wide text-[var(--lg-ink-dim)] normal-case">
                {s.unit}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--lg-ink-dim)]">{s.label}</p>
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
      <p className="mono text-xs tracking-[0.25em]" style={{ color: "var(--lg-amber)" }}>
        WHAT&apos;S UNDER THE HOOD
      </p>
      <h2 className="display mt-3 max-w-lg text-4xl font-bold leading-[0.95] sm:text-5xl">
        Built to survive an audit, not just a glance.
      </h2>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-line)] sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-[var(--lg-bg-raised)] p-7">
            <h3 className="display text-xl font-bold">{f.title}</h3>
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
    <section className="border-y border-[var(--lg-line)] bg-[var(--lg-bg-raised)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
        <h2 className="display text-3xl font-bold sm:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="mono text-3xl font-medium" style={{ color: "var(--lg-blue)" }}>
                {s.n}
              </p>
              <h3 className="display mt-2 text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--lg-ink-dim)]">{s.body}</p>
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
      <div className="grid gap-8 rounded-2xl border border-[var(--lg-line)] bg-[var(--lg-bg-raised)] p-8 sm:grid-cols-2 sm:p-12">
        <div>
          <p className="mono text-xs tracking-[0.25em]" style={{ color: "var(--lg-amber)" }}>
            REPORT PORTAL
          </p>
          <h2 className="display mt-3 text-3xl font-bold leading-[0.95] sm:text-4xl">
            Preparing someone&apos;s taxes?
          </h2>
          <p className="mt-4 text-sm text-[var(--lg-ink-dim)]">
            Your client generates a one-time access code from their
            ControlMiles account. Enter it here to view a read-only
            mileage summary — no login, no account, nothing installed.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Link
            href="/portal/verify"
            className="rounded-full px-6 py-3 text-center text-sm font-semibold text-[#0a0c11] transition hover:opacity-90"
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

function Footer() {
  return (
    <footer className="border-t border-[var(--lg-line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-[var(--lg-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <span className="display tracking-widest">CONTROLMILES</span>
        <span>An Olympus Mont Systems LLC product.</span>
      </div>
    </footer>
  );
}
