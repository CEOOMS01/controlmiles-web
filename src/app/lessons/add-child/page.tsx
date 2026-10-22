// Olympus Mont Systems LLC - ControlMiles Web
// src/app/lessons/add-child/page.tsx
//
// A signed-in parent enrolls another child under 18 (2026-10-22). It is an
// enrollment request on the parent's profile: the school approves it, and
// only then does the child appear on the portal (ds_client_add_child,
// ds_enrollment_approve).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lessonsSession } from "@/lib/lessons-session";
import { AddChildForm, type ChildFormPage } from "./add-child-form";

export const metadata: Metadata = { title: "Enroll a child · Driving lessons", robots: { index: false, follow: false } };

export default async function AddChildPage() {
  const session = await lessonsSession();
  if (!session) redirect("/lessons");
  const supabase = await createClient();
  const { data: home } = await supabase.rpc("ds_client_home", { p_session: session });
  const h = home as { client: { first_name: string; last_name: string }; enroll_slug: string | null } | null;
  if (!h) redirect("/lessons");

  const { data: page } = h.enroll_slug
    ? await supabase.rpc("ds_public_page", { p_slug: h.enroll_slug })
    : { data: null };
  const p = page as ChildFormPage | null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/lessons" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← Your portal
      </Link>
      <h1 className="text-2xl font-semibold">Enroll a child</h1>
      {!p ? (
        <p className="mt-2 text-sm text-muted">This school isn&apos;t taking online requests right now. Contact the school directly.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            For a child under 18. {p.school} confirms the enrollment; then your child appears on your portal.
          </p>
          <AddChildForm page={p} parentName={`${h.client.first_name} ${h.client.last_name}`} />
        </>
      )}
    </main>
  );
}
