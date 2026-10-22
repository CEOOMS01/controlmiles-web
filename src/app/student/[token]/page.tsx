// Olympus Mont Systems LLC - ControlMiles Web
// src/app/student/[token]/page.tsx
//
// Driving school student / parent portal (2026-10-19): opened with the
// private link the school sends; no account. ds_portal_view checks the token
// (hashed, expiring, revocable) and the school's plan. The client portal
// (/lessons, 2026-10-22) shows the same view to a signed-in parent or adult.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PortalView, type View } from "../portal-view";

export const metadata: Metadata = { title: "Your driving lessons · ControlMiles", robots: { index: false } };

export default async function StudentPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_portal_view", { p_token: token });
  const v = data as View | null;

  if (!v) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">This link isn&apos;t active</h1>
        <p className="mt-2 text-sm text-muted">Ask your driving school for a new link.</p>
      </main>
    );
  }

  return (
    <PortalView
      v={v}
      access={{ token }}
      certificateBase={`/student/${token}/certificate`}
      footer="ControlMiles · This page is private to you; don't share the link."
    />
  );
}
