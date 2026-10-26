// Olympus Mont Systems LLC - ControlMiles Web
// src/app/student/[token]/page.tsx
//
// Driving school student / parent portal (2026-10-19): opened with the
// private link the school sends; no account. Upcoming classes, hours
// against the requirement (from real GPS trips), each class's report card
// and the certificate. ds_portal_view checks the token (hashed, expiring,
// revocable) and the school's plan.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SCORE_CLASS, formatMinutes, percentOf } from "@/lib/driving-school";
import { BookLesson, CancelLesson, SmsOptIn } from "./portal-booking";
import { DATE_LOCALE, STR, fill, pickLang, type Lang } from "./strings";

/** Inside the free-cancellation window? (module level: reads the clock) */
function isLateToCancel(startsAt: string, freeHours: number): boolean {
  return new Date(startsAt).getTime() - Date.now() < freeHours * 3600_000;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const lang = pickLang((await searchParams).lang, (await headers()).get("accept-language"));
  return { title: STR[lang].metaTitle, robots: { index: false } };
}

type View = {
  school: string;
  timezone: string;
  student: { first_name: string; last_name: string };
  program: string;
  required_minutes: number;
  required_night_minutes: number;
  minutes: number;
  night_minutes: number;
  miles: number;
  upcoming: { id: string; date: string; start: string; end: string; instructor: string | null; starts_at: string }[];
  booking: { enabled: boolean; cancel_free_hours: number; policy: string | null; max_upcoming: number };
  balance: { purchased: number; used: number; booked: number; available: number } | null;
  sms: { available: boolean; consent: boolean; phone: string | null };
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
const dayFor = (lang: Lang) => (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(DATE_LOCALE[lang], { weekday: "short", month: "short", day: "numeric" });

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

export default async function StudentPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = pickLang((await searchParams).lang, (await headers()).get("accept-language"));
  const S = STR[lang];
  const day = dayFor(lang);
  const SCORE_LABELS: Record<number, string> = { 1: S.score1, 2: S.score2, 3: S.score3, 4: S.score4 };
  const supabase = await createClient();
  const { data } = await supabase.rpc("ds_portal_view", { p_token: token });
  const v = data as View | null;

  if (!v) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">{S.inactiveTitle}</h1>
        <p className="mt-2 text-sm text-muted">{S.inactiveBody}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{v.school}</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {v.student.first_name} {v.student.last_name}
      </h1>

      {v.program && <p className="mt-1 text-sm text-muted">{v.program}</p>}

      <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
        {v.required_minutes > 0 && <Bar value={v.minutes} required={v.required_minutes} label={S.behindWheel} />}
        {v.required_night_minutes > 0 && <Bar value={v.night_minutes} required={v.required_night_minutes} label={S.atNight} />}
        {v.required_minutes === 0 && (
          <p className="text-sm">
            <span className="font-semibold">{formatMinutes(v.minutes)}</span> {S.behindWheel.toLowerCase()}
            {v.night_minutes > 0 && `, ${formatMinutes(v.night_minutes)} ${S.nightInline}`}.
          </p>
        )}
        {v.balance && (
          <p className="text-sm">
            {S.packagesLeft}{" "}
            <span className={`font-semibold ${v.balance.available < 0 ? "text-danger" : ""}`}>
              {formatMinutes(Math.max(0, v.balance.available))}
            </span>
            {v.balance.booked > 0 && <span className="text-muted"> {fill(S.afterBooked, { time: formatMinutes(v.balance.booked) })}</span>}
          </p>
        )}
        <p className="text-sm text-muted">
          {fill(S.classesMiles, { n: v.classes.length, mi: Number(v.miles).toFixed(1) })}
        </p>
      </section>

      {v.certificates.length > 0 && (
        <section className="mt-6 rounded-xl border border-success/40 bg-success/5 p-5">
          <h2 className="font-semibold">{S.certificate}</h2>
          {v.certificates.map((c) => (
            <p key={c.number} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {c.number} · {new Date(c.issued_at).toLocaleDateString(DATE_LOCALE[lang], { dateStyle: "medium" })}
              </span>
              <a href={`/student/${token}/certificate/${encodeURIComponent(c.number)}`} className="font-medium text-accent hover:underline">
                {S.downloadPdf}
              </a>
            </p>
          ))}
        </section>
      )}

      {v.booking.enabled && (
        <section className="mt-6">
          <BookLesson token={token} policy={v.booking.policy} lang={lang} noHours={v.balance !== null && v.balance.available <= 0}
            mine={v.upcoming
              .filter((u) => u.id)
              .map((u) => ({ id: u.id, date: u.date, start: u.start, end: u.end, late: isLateToCancel(u.starts_at, v.booking.cancel_free_hours) }))}
          />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">{S.upcoming}</h2>
        {v.upcoming.length === 0 ? (
          <p className="text-sm text-muted">{S.noUpcoming}</p>
        ) : (
          <ul className="space-y-2">
            {v.upcoming.map((u, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{day(u.date)}</span> · {time12(u.start)}–{time12(u.end)}
                  {u.instructor && <span className="text-muted"> · {u.instructor.trim()}</span>}
                </span>
                {v.booking.enabled && u.id && (
                  <CancelLesson token={token} blockId={u.id} late={isLateToCancel(u.starts_at, v.booking.cancel_free_hours)} lang={lang} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">{S.finished}</h2>
        {v.classes.length === 0 ? (
          <p className="text-sm text-muted">{S.noFinished}</p>
        ) : (
          <ul className="space-y-3">
            {[...v.classes].reverse().map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p>
                  <span className="font-medium">{day(c.date)}</span> · {time12(c.start)} · {formatMinutes(c.minutes)}
                  {c.night_minutes > 0 && ` (${formatMinutes(c.night_minutes)} ${S.night})`} · {Number(c.miles).toFixed(1)} {S.mi}
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

      {v.sms.available && (
        <section className="mt-6">
          <SmsOptIn token={token} consent={v.sms.consent} phone={v.sms.phone} lang={lang} />
        </section>
      )}

      <p className="mt-10 text-center text-xs text-muted">{S.private}</p>
    </main>
  );
}
