// Olympus Mont Systems LLC - ControlMiles
// src/components/back-to-home.tsx
//
// Explicit user request: no way back to the marketing site from
// login/signup/forgot-password/reset-password -- those pages render
// standalone (root layout.tsx has no header at all, see its own
// comment), so landing here from anywhere but a click on the landing
// page's own "Sign in" button is a dead end. Fixed top-left corner,
// same placement convention as Stripe/Linear/Vercel auth screens --
// deliberately NOT the landing page's cream/pill nav styling
// (landing-chrome.tsx's --lg-* tokens), since these auth pages use
// their own plain neutral design system (--foreground/--muted/--surface,
// see globals.css) and importing the marketing chrome's look here would
// clash rather than match.

import Link from "next/link";

export function BackToHome() {
  return (
    <Link
      href="/"
      aria-label="Back to ControlMiles"
      className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground sm:left-6 sm:top-6"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      Back
    </Link>
  );
}
