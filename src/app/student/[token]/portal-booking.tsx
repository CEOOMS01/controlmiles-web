"use client";

// Driving school portal: book a lesson, cancel one, text reminders
// (2026-10-19, phase 2).

import { useState, useTransition } from "react";
import { bookSlot, cancelLesson, getSlots, setSms, type Slot } from "./actions";

const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const btn = "rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent disabled:opacity-50";
const primary = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50";

export function BookLesson({ token, policy }: { token: string; policy: string | null }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [language, setLanguage] = useState<"en" | "es" | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setError(null);
      const r = await getSlots(token);
      if (!r) return setError("Online booking isn't available right now.");
      setMinutes(r.minutes);
      setLanguage(r.language ?? null);
      setSlots(r.slots);
      setOpen(true);
    });

  const confirm = () =>
    chosen &&
    start(async () => {
      const r = await bookSlot(token, chosen);
      if (r.error) {
        setError(r.error);
        setChosen(null);
        const again = await getSlots(token);
        if (again) setSlots(again.slots);
        return;
      }
      setDone(`Booked: ${day(chosen.date)} at ${time12(chosen.start)}.`);
      setChosen(null);
      setOpen(false);
    });

  const days = [...new Set((slots ?? []).map((s) => s.date))];
  // One day at a time (Calendly / Acuity style): the confirmation sits right
  // under the times instead of after every day of the next weeks.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const shownDay = pickedDay && days.includes(pickedDay) ? pickedDay : (days[0] ?? null);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Book a lesson</h2>
        {!open && (
          <button type="button" onClick={load} disabled={pending} className={primary}>
            {pending ? "Loading…" : "See free times"}
          </button>
        )}
      </div>
      {done && <p className="mt-2 text-sm text-success">{done}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {open && slots && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            {minutes}-minute lessons
            {language ? ` with an instructor who teaches in ${language === "es" ? "Spanish" : "English"}` : ""}. Pick a time;
            the school assigns the instructor.
          </p>
          {days.length === 0 && <p className="text-sm text-muted">No free times right now. Check back soon.</p>}
          {days.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Days">
              {days.map((d) => {
                const on = d === shownDay;
                const count = slots.filter((s) => s.date === d).length;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setPickedDay(d);
                      setChosen(null);
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      on ? "border-accent bg-accent/10 font-semibold" : "border-border hover:border-accent"
                    }`}
                  >
                    <span className="block">{day(d)}</span>
                    <span className="block text-xs font-normal text-muted">
                      {count} {count === 1 ? "time" : "times"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {shownDay && (
            <div key={shownDay}>
              <div className="flex flex-wrap gap-2">
                {slots
                  .filter((s) => s.date === shownDay)
                  .map((s) => {
                    const sel = chosen === s;
                    return (
                      <button
                        key={`${s.date}-${s.start}`}
                        type="button"
                        onClick={() => {
                          setChosen(s);
                          setError(null);
                        }}
                        className={`${btn} ${sel ? "border-accent bg-accent/10" : ""}`}
                      >
                        {time12(s.start)}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {chosen && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
              <p className="font-medium">
                {day(chosen.date)} · {time12(chosen.start)}–{time12(chosen.end)}
              </p>
              {policy && <p className="mt-2 text-muted">{policy}</p>}
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                <span>I agree to the school&apos;s cancellation policy.</span>
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirm} disabled={pending || !agreed} className={primary}>
                  {pending ? "Booking…" : "Book this lesson"}
                </button>
                <button type="button" onClick={() => setChosen(null)} className={btn}>
                  Back
                </button>
              </div>
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export function CancelLesson({ token, blockId, late }: { token: string; blockId: string; late: boolean }) {
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="text-xs text-danger hover:underline">
        Cancel
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className={late ? "text-danger" : "text-muted"}>
        {late ? "It's late to cancel: this lesson will count as used." : "Free cancellation."}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelLesson(token, blockId);
            if (r.error) setError(r.error);
          })
        }
        className="rounded border border-danger px-2 py-0.5 text-danger"
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button type="button" onClick={() => setAsk(false)} className="text-muted">
        Keep it
      </button>
      {error && <span className="w-full text-danger">{error}</span>}
    </span>
  );
}

export function SmsOptIn({ token, consent, phone }: { token: string; consent: boolean; phone: string | null }) {
  const [value, setValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-sm">
      <h2 className="font-semibold">Text reminders</h2>
      {consent ? (
        <p className="mt-1 text-muted">
          On for {phone}. Reply STOP to any text, or{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setError((await setSms(token, false, "")).error))}
            className="text-accent hover:underline"
          >
            turn them off
          </button>
          .
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="tel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Mobile number"
            className="rounded-lg border border-border bg-background px-3 py-1.5"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setError((await setSms(token, true, value)).error))}
            className={btn}
          >
            Text me reminders
          </button>
          <p className="w-full text-xs text-muted">
            By turning this on you agree to receive lesson reminder texts from your school. Message and data rates may
            apply. Reply STOP to opt out.
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-danger">{error}</p>}
    </div>
  );
}
