// Olympus Mont Systems LLC - ControlMiles
// src/components/landing-chrome.tsx
//
// Shared Nav/Footer for the landing page AND any other page that uses the
// same warm/light landing.css aesthetic (legal pages) -- extracted out of
// page.tsx rather than duplicated, so the two never drift.

import Link from "next/link";
import Image from "next/image";

export function LandingNav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <Link href="/" className="flex items-center gap-2.5">
        <Image
          src="/logo_controlmiles.png"
          alt="ControlMiles"
          width={32}
          height={32}
          className="nav-mark-in rounded"
          priority
        />
        <span className="nav-word-in display text-xl font-semibold">
          Control<span style={{ color: "var(--lg-blue-deep)" }}>Miles</span>
        </span>
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link
          href="/pricing"
          className="hidden rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] sm:inline"
        >
          Pricing
        </Link>
        <Link
          href="/portal/verify"
          className="hidden rounded-full border border-[var(--lg-line)] px-4 py-2 font-medium text-[var(--lg-ink-dim)] transition hover:border-[var(--lg-blue)] hover:text-[var(--lg-ink)] sm:inline"
        >
          Verify a report
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-[var(--lg-ink)] bg-[var(--lg-ink)] px-4 py-2 font-medium text-[var(--lg-bg)] transition hover:border-[var(--lg-blue-deep)] hover:bg-[var(--lg-blue-deep)]"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--lg-line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-[var(--lg-ink-dim)] sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <span className="display font-medium">ControlMiles</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="transition hover:text-[var(--lg-ink)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-[var(--lg-ink)]">
            Terms of Service
          </Link>
          <a href="mailto:support@controlmiles.com" className="transition hover:text-[var(--lg-ink)]">
            support@controlmiles.com
          </a>
          <a href="mailto:contact@controlmiles.com" className="transition hover:text-[var(--lg-ink)]">
            contact@controlmiles.com
          </a>
        </nav>
        <span>© 2026 ControlMiles. All rights reserved. Powered by Olimsys.</span>
      </div>
    </footer>
  );
}
