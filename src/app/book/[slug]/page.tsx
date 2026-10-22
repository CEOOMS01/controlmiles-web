// Olympus Mont Systems LLC - ControlMiles Web
// src/app/book/[slug]/page.tsx
//
// A driving school's public page (2026-10-20, Enterprise): students and
// parents ask to enroll from the school's own website (a button that opens
// this page, or this page in an iframe with ?embed=1). Requests wait for the
// office in Students; nothing becomes a student until someone approves it.
// No analytics or third-party scripts here: the visitors are often minors.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EnrollForm } from "./enroll-form";

type PublicPage = {
  school: string;
  intro: string | null;
  min_age: number;
  age_of_majority: number;
  terms_url: string | null;
  programs: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};

async function load(slug: string): Promise<PublicPage | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_public_page", { p_slug: slug });
  return (data as PublicPage | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  return {
    title: page ? `Enroll · ${page.school}` : "Enrollment",
    robots: { index: false, follow: false },
  };
}

export default async function BookPage({
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
        <p className="mt-2 text-sm text-muted">Contact the driving school directly to enroll.</p>
      </main>
    );
  }

  return (
    <main className={embed ? "px-4 py-6" : "mx-auto max-w-2xl px-5 py-10"}>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{page.school}</p>
      <h1 className="mt-1 text-2xl font-semibold">Enroll in driving lessons</h1>
      <p className="mt-2 text-sm text-muted">
        {page.intro || "Send your request and the school will contact you to confirm enrollment and schedule the first lesson."}
      </p>

      <EnrollForm slug={slug} page={page} embed={embed} />

      <p className="mt-8 text-xs text-muted">
        Your information goes only to {page.school} to handle this request. It isn&apos;t sold or used for ads.
        Requests the school doesn&apos;t act on are deleted after 90 days.{" "}
        {!embed && (
          <a href="https://controlmiles.com/fleet" className="hover:text-foreground" target="_blank" rel="noopener">
            Powered by CMFleet
          </a>
        )}
      </p>
    </main>
  );
}
