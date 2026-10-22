// Olympus Mont Systems LLC - ControlMiles Web
// src/app/lessons/page.tsx
//
// Driving school client portal (2026-10-22): the only place on the website
// for people who aren't fleet staff. Adult students and parents of minors
// sign in with a link by email -- no app, no password -- and see the
// students on their profile. A minor shows here only while a minor and not
// emancipated (the database checks it on every read).

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lessonsSession } from "@/lib/lessons-session";
import { signOut } from "./actions";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Driving lessons · ControlMiles", robots: { index: false, follow: false } };

type Home = {
  school: string;
  client: { first_name: string; last_name: string; email: string };
  students: { id: string; first_name: string; last_name: string; status: string; relation: "self" | "guardian" }[];
  pending: { first_name: string; requested_at: string }[];
  enroll_slug: string | null;
};

export default async function LessonsPage() {
  const session = await lessonsSession();
  let home: Home | null = null;
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("ds_client_home", { p_session: session });
    home = (data as Home | null) ?? null;
  }

  if (!home) {
    return (
      <main className="mx-auto max-w-sm px-5 py-16">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Driving lessons</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in to your portal</h1>
        <p className="mt-2 text-sm text-muted">
          For students and parents of a driving school that uses ControlMiles. Enter the email the school has for you
          and we&apos;ll send you a link. No app or password needed.
        </p>
        <SignInForm />
      </main>
    );
  }

  const parent = home.students.some((s) => s.relation === "guardian") || home.pending.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">{home.school}</p>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
      <h1 className="mt-1 text-2xl font-semibold">Hi, {home.client.first_name}</h1>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">{parent ? "Your students" : "Your lessons"}</h2>
        {home.students.length === 0 ? (
          <p className="text-sm text-muted">
            No students on your profile right now. A parent sees a child here until the child turns adult or is
            emancipated; after that the student signs in with their own email.
          </p>
        ) : (
          <ul className="space-y-2">
            {home.students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/lessons/student/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm transition hover:border-accent"
                >
                  <span className="font-medium">
                    {s.first_name} {s.last_name}
                    {s.relation === "self" && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="text-accent">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {home.pending.length > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm">
          <h2 className="font-semibold">Waiting for the school</h2>
          <ul className="mt-2 space-y-1 text-muted">
            {home.pending.map((p, i) => (
              <li key={i}>
                {p.first_name} · requested {new Date(p.requested_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {home.enroll_slug && (
        <p className="mt-6 text-sm">
          <Link href="/lessons/add-child" className="font-medium text-accent hover:underline">
            Enroll another child under 18
          </Link>
          <span className="text-muted"> · the school confirms before the child appears here.</span>
        </p>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        ControlMiles · Signed in as {home.client.email}. This page is private to you.
      </p>
    </main>
  );
}
