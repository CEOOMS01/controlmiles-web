"use client";

// Blocked hours (2026-10-26): hours the school marks off, such as lunch from
// 12 to 1 PM. No class can be booked in them, by the office or online. It can
// apply to the whole school or to one instructor, every day, on chosen weekdays
// or on one date.

import { useState, useTransition } from "react";
import { WEEKDAYS } from "@/lib/driving-school";
import { addBlockedHours, deleteBlockedHours } from "./agenda-actions";

type Option = { id: string; label: string };

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const label = "mb-1 block text-xs font-medium text-muted";

export function BlockedHoursForm({ orgId, instructors }: { orgId: string; instructors: Option[] }) {
  const [name, setName] = useState("Lunch");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [who, setWho] = useState("");
  const [when, setWhen] = useState<"every" | "weekdays" | "date">("every");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [onDate, setOnDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setOk(false);
    if (when === "weekdays" && days.length === 0) return setError("Pick at least one day.");
    if (when === "date" && !onDate) return setError("Pick the date.");
    startTransition(async () => {
      const r = await addBlockedHours({
        orgId,
        instructorId: who || null,
        weekdays: when === "weekdays" ? days : [],
        onDate: when === "date" ? onDate : null,
        start,
        end,
        label: name,
      });
      if (r.error) setError(r.error);
      else setOk(true);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={label}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Lunch" className={field} />
        </div>
        <div>
          <label className={label}>From</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>To</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>Applies to</label>
          <select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
            <option value="">The whole school</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {(
          [
            ["every", "Every day"],
            ["weekdays", "Chosen weekdays"],
            ["date", "One date"],
          ] as const
        ).map(([v, text]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="radio" name="blocked-when" checked={when === v} onChange={() => setWhen(v)} /> {text}
          </label>
        ))}
      </div>
      {when === "weekdays" && (
        <div className="flex flex-wrap gap-3 text-sm">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={days.includes(i)}
                onChange={(e) => setDays((cur) => (e.target.checked ? [...cur, i] : cur.filter((x) => x !== i)))}
              />{" "}
              {d.slice(0, 3)}
            </label>
          ))}
        </div>
      )}
      {when === "date" && <input type="date" value={onDate} onChange={(e) => setOnDate(e.target.value)} className={`${field} max-w-xs`} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {ok && !error && <p className="text-sm text-success">Saved. Nobody can book those hours now.</p>}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-border-strong disabled:opacity-60"
      >
        {pending ? "Saving…" : "Block these hours"}
      </button>
    </div>
  );
}

export function RemoveBlocked({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await deleteBlockedHours(id)))}
      className="text-xs text-danger hover:underline disabled:opacity-60"
    >
      Remove
    </button>
  );
}
