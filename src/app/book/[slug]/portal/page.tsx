// Olympus Mont Systems LLC - ControlMiles Web
// src/app/book/[slug]/portal/page.tsx
//
// The school's embeddable portal (2026-11-18, phase 1): inside the school's own website (iframe with
// ?embed=1) a client sees the school's services and prices per location, how the school gets paid, and
// the way to enroll. ControlMiles never takes the payment: the client pays the school (at the school,
// or on the school's own payment page). No analytics or third-party scripts: the visitors are often minors.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PortalView, type PortalData } from "./portal-view";

async function load(slug: string): Promise<PortalData | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_public_page", { p_slug: slug });
  return (data as PortalData | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  return { title: page ? `Services · ${page.school}` : "Services", robots: { index: false, follow: false } };
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { slug } = await params;
  const embed = (await searchParams).embed === "1";
  const page = await load(slug);

  if (!page) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">This page isn&apos;t available</h1>
        <p className="mt-2 text-sm text-muted">Contact the driving school directly.</p>
      </main>
    );
  }

  return <PortalView slug={slug} page={page} embed={embed} />;
}
