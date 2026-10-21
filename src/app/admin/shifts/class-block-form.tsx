"use client";

import { useRef, useState, useTransition } from "react";
import { useSheet } from "@/components/sheet";
import { addClassBlock } from "./actions";
import { TimeInput } from "@/components/time-input";

type Option = { id: string; label: string };

// One-off class on a specific date (driving-school style), on top of the
// weekly template. Same look as ShiftForm.
export function ClassBlockForm({
  orgId,
  drivers,
  vehicles,
  students = [],
  timeFormat,
  defaultDate,
  inSheet = false,
}: {
  orgId: string;
  drivers: Option[];
  vehicles: Option[];
  // Driving school students (2026-10-19): empty when the plan has none.
  students?: Option[];
  timeFormat: "12h" | "24h";
  defaultDate: string;
  // In the page header's slide-over panel (2026-10-20 redesign).
  inSheet?: boolean;
}) {
  const [open, setOpen] = useState(inSheet);
  const sheet = useSheet();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addClassBlock({ error: null, success: false }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      if (inSheet) sheet.close();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Add class
      </button>
    );
  }

  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={`flex flex-col gap-4 ${inSheet ? "" : "rounded-xl border border-border bg-surface p-5"}`}
    >
      <input type="hidden" name="org_id" value={orgId} />

      {students.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Student</label>
          <select name="student_id" defaultValue="" className={field}>
            <option value="">No student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Instructor</label>
          <select name="driver_id" required defaultValue="" className={field}>
            <option value="" disabled>
              Select an instructor
            </option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Date</label>
          <input name="block_date" type="date" required defaultValue={defaultDate} className={field} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Start time</label>
          <TimeInput name="start_time" format={timeFormat} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">End time</label>
          <TimeInput name="end_time" format={timeFormat} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Vehicle (optional)</label>
          <select name="vehicle_id" defaultValue="" className={field}>
            <option value="">Unassigned</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
          <input name="note" type="text" placeholder="e.g. Class — Juan Pérez" className={field} />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add class"}
        </button>
        <button
          type="button"
          onClick={() => (inSheet ? sheet.close() : setOpen(false))}
          className="rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
