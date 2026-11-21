"use client";

// Reset the class calendar (2026-11-20, owner request: "the calendar must be able to go back to clean, and I do not
// see how to undo the days off"). Every piece can be cleared on its own or all together; nothing happens until the
// second click, which shows exactly what will go. The server action only deletes what the database policies allow.

import { useState, useTransition } from "react";
import { resetCalendar, type ResetResult } from "./agenda-actions";

export type ResetCounts = { daysOff: number; blockedHours: number; availability: number; classes: number };

const PARTS: { key: keyof ResetCounts; label: string; help: string }[] = [
  { key: "daysOff", label: "Days off", help: "Every day off from today on. The instructors can be booked again." },
  { key: "blockedHours", label: "Blocked hours", help: "Lunch and other blocked hours, weekly or on a date from today on." },
  { key: "classes", label: "Classes not taught yet", help: "Scheduled classes from today on. Cancelled, in-progress and finished classes stay." },
  { key: "availability", label: "Instructor availability", help: "The weekly hours students book into. Add them again to reopen online booking." },
];

const noun = (key: keyof ResetCounts, n: number) =>
  ({
    daysOff: n === 1 ? "day off" : "days off",
    blockedHours: n === 1 ? "blocked hour" : "blocked hours",
    classes: n === 1 ? "class" : "classes",
    availability: n === 1 ? "availability slot" : "availability slots",
  })[key];

/** The whole panel: pick what to clean, confirm, done. */
export function ResetCalendar({ orgId, today, counts }: { orgId: string; today: string; counts: ResetCounts }) {
  const [picked, setPicked] = useState<Record<keyof ResetCounts, boolean>>({
    daysOff: false,
    blockedHours: false,
    classes: false,
    availability: false,
  });
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [pending, start] = useTransition();

  const chosen = PARTS.filter((p) => picked[p.key]);
  const total = chosen.reduce((s, p) => s + counts[p.key], 0);

  function run() {
    start(async () => {
      const r = await resetCalendar({ orgId, today, ...picked });
      setResult(r);
      setConfirming(false);
      setPicked({ daysOff: false, blockedHours: false, classes: false, availability: false });
    });
  }

  return (
    <section className="mb-10 rounded-xl border border-danger/30 p-5">
      <h2 className="text-base font-semibold text-danger">Reset the calendar</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Take the calendar back to clean. Pick what to clear; nothing is removed until you confirm. History (days already
        taught, past days off) is never touched.
      </p>

      <ul className="mt-4 space-y-2">
        {PARTS.map((p) => (
          <li key={p.key}>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={picked[p.key]}
                disabled={pending}
                onChange={(e) => {
                  setConfirming(false);
                  setResult(null);
                  setPicked((prev) => ({ ...prev, [p.key]: e.target.checked }));
                }}
              />
              <span>
                <span className="font-medium">
                  {p.label} <span className="font-normal text-muted">· {counts[p.key]} now</span>
                </span>
                <span className="block text-xs text-muted">{p.help}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!confirming ? (
          <button
            type="button"
            disabled={chosen.length === 0 || pending}
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger hover:text-danger-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-danger"
          >
            Reset selected
          </button>
        ) : (
          <>
            <p className="text-sm">
              This will remove{" "}
              <strong>
                {total} {total === 1 ? "item" : "items"}
              </strong>
              : {chosen.map((p) => `${counts[p.key]} ${noun(p.key, counts[p.key])}`).join(", ")}. It cannot be undone.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={run}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-sm text-muted hover:underline">
              Cancel
            </button>
          </>
        )}
      </div>

      {result && (
        <p className={`mt-3 text-sm ${result.error ? "text-danger" : "text-success"}`} role="status">
          {result.error ??
            (PARTS.filter((p) => result.removed[p.key] > 0).length === 0
              ? "Nothing to remove."
              : `Removed ${PARTS.filter((p) => result.removed[p.key] > 0)
                  .map((p) => `${result.removed[p.key]} ${noun(p.key, result.removed[p.key])}`)
                  .join(", ")}.`)}
        </p>
      )}
    </section>
  );
}

/** "Remove all" next to the days-off list: the quick way back to no days off. */
export function ClearDaysOffButton({ orgId, today, count }: { orgId: string; today: string; count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (count === 0) return null;
  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-xs font-medium text-danger hover:underline">
        Remove all days off
      </button>
    );
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted">Remove {count} from today on?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await resetCalendar({ orgId, today, daysOff: true, blockedHours: false, availability: false, classes: false });
            setConfirming(false);
          })
        }
        className="font-semibold text-danger hover:underline disabled:opacity-60"
      >
        {pending ? "Removing…" : "Yes"}
      </button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-muted hover:underline">
        No
      </button>
    </span>
  );
}
