// Olympus Mont Systems LLC - ControlMiles Web
// src/app/lessons/access/[token]/page.tsx
//
// The sign-in link from the email (2026-10-22). Opening the page does
// nothing by itself: email scanners open links before people do, and the
// link works once. The button signs in (openLink), so only a person uses it.

import type { Metadata } from "next";
import { OpenLinkForm } from "./open-link-form";

export const metadata: Metadata = { title: "Sign in · Driving lessons", robots: { index: false, follow: false } };

export default async function LessonsAccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-sm px-5 py-16 text-center">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Driving lessons</p>
      <h1 className="mt-1 text-2xl font-semibold">Open your portal</h1>
      <p className="mt-2 text-sm text-muted">You&apos;ll stay signed in on this device for 30 days.</p>
      <OpenLinkForm token={token} />
    </main>
  );
}
