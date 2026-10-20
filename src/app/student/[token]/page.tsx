// Olympus Mont Systems LLC - ControlMiles Web
// src/app/student/[token]/page.tsx
//
// Driving school student / parent portal (2026-10-19): opened with the
// private link the school sends; no account. Upcoming classes, hours
// against the requirement (from real GPS trips), each class's report card
// and the certificate. ds_portal_view checks the token (hashed, expiring,
// revocable) and the school's plan.

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SCORE_CLASS, SCORE_LABELS, formatMinutes, percentOf } from "@/lib/driving-school";

export const metadata: Metadata = { title: "Your driving lessons · ControlMiles", robots: { index: false } };

type View = {
  school: string;
  timezone: string;
  student: { first_name: string; last_name: string };
  required_minutes: number;
  required_night_minutes: number;
  minutes: number;
  night_minutes: number;
  miles: number;
  upcoming: { date: string; start: string; end: string; instructor: string | null }[];
  classes: {
    date: string;
    start: string;
    instructor: string | null;
    minutes: number;
    night_minutes: number;
    miles: number;
    evaluation: { note: string | null; scores: { skill: string; category: string; score: number }[] } | null;
  }[];
  certificates: { number: string; issued_at: string; sha256: string }[];
};

const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function Bar({ value, required, label }: { value: number; required: number; label: string }) {
  const pct = percentOf(value, required);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {formatMinutes(value)} / {formatMinutes(required)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${pct >= 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{v.school}</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {v.student.first_name} {v.student.last_name}
      </h1>

      <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
        <Bar value={v.minutes} required={v.required_minutes} label="Behind the wheel" />
        {v.required_night_minutes > 0 && <Bar value={v.night_minutes} required={v.required_night_minutes} label="At night" />}
        <p className="text-sm text-muted">
          {v.classes.length} classes · {Number(v.miles).toFixed(1)} miles. Every class is recorded by GPS during the lesson.
        </p>
      </section>

      {v.certificates.length > 0 && (
        <section className="mt-6 rounded-xl border border-success/40 bg-success/5 p-5">
          <h2 className="font-semibold">Certificate</h2>
          {v.certificates.map((c) => (
            <p key={c.number} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {c.number} · {new Date(c.issued_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
              </span>
              <a href={`/student/${token}/certificate/${encodeURIComponent(c.number)}`} className="font-medium text-accent hover:underline">
                Download PDF
              </a>
            </p>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Upcoming classes</h2>
        {v.upcoming.length === 0 ? (
          <p className="text-sm text-muted">No classes scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {v.upcoming.map((u, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <span className="font-medium">{day(u.date)}</span> · {time12(u.start)}–{time12(u.end)}
                {u.instructor && <span className="text-muted"> · {u.instructor}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Finished classes</h2>
        {v.classes.length === 0 ? (
          <p className="text-sm text-muted">No finished classes yet.</p>
        ) : (
          <ul className="space-y-3">
            {[...v.classes].reverse().map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p>
                  <span className="font-medium">{day(c.date)}</span> · {time12(c.start)} · {formatMinutes(c.minutes)}
                  {c.night_minutes > 0 && ` (${formatMinutes(c.night_minutes)} night)`} · {Number(c.miles).toFixed(1)} mi
                  {c.instructor && <span className="text-muted"> · {c.instructor}</span>}
                </p>
                {c.evaluation && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.evaluation.scores.map((s) => (
                      <span key={s.skill} className={`rounded-full px-2 py-0.5 text-xs ${SCORE_CLASS[s.score]}`}>
                        {s.skill}: {SCORE_LABELS[s.score]}
                      </span>
                    ))}
                    {c.evaluation.note && <p className="w-full text-xs text-muted">“{c.evaluation.note}”</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-muted">ControlMiles · This page is private to you; don&apos;t share the link.</p>
    </main>
  );
}
