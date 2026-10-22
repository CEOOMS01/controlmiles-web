// Olympus Mont Systems LLC - ControlMiles Web
// src/app/lessons/student/[id]/page.tsx
//
// One student, for a signed-in parent or adult (2026-10-22). Same view as
// the per-student link; ds_client_student_view checks the session and that
// this student is on the profile (a parent: only while a minor and not
// emancipated).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lessonsSession } from "@/lib/lessons-session";
import { PortalView, type View } from "../../../student/portal-view";

export const metadata: Metadata = { title: "Driving lessons · ControlMiles", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LessonsStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await lessonsSession();
  if (!session) redirect("/lessons");

  const supabase = await createClient();
  const { data, error } = UUID.test(id)
    ? await supabase.rpc("ds_client_student_view", { p_session: session, p_student: id })
    : { data: null, error: { message: "NO_ACCESS" } };
  if (error?.message.includes("SESSION_ENDED")) redirect("/lessons");
  const v = data as View | null;

  if (!v) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">Not on your profile</h1>
        <p className="mt-2 text-sm text-muted">
          A parent sees a student only until the student turns adult or is emancipated.
        </p>
        <Link href="/lessons" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to your portal
        </Link>
      </main>
    );
  }

  return (
    <PortalView
      v={v}
      access={{ student: id }}
      certificateBase={`/lessons/student/${id}/certificate`}
      footer="ControlMiles · This page is private to you."
      top={
        <Link href="/lessons" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
          ← All students
        </Link>
      }
    />
  );
}
