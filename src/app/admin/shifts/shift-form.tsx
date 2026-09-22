"use client";

import { useRef, useState, useTransition } from "react";
import { addShift } from "./actions";
import { TimeInput } from "@/components/time-input";

type Driver = { id: string; label: string };
type Vehicle = { id: string; label: string };

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function ShiftForm({
  orgId,
  drivers,
  vehicles,
  timeFormat,
}: {
  orgId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
  timeFormat: "12h" | "24h";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleDay(day: number) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addShift({ error: null, success: false }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setSelectedDays([1, 2, 3, 4, 5]);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Add shift
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
    >
      <input type="hidden" name="org_id" value={orgId} />

      <div>
        <label className="mb-1.5 block text-sm font-medium">Driver</label>
        <select
          name="driver_id"
          required
          defaultValue=""
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            Select a driver
          </option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Days</label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <label
              key={d.value}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                selectedDays.includes(d.value)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:border-accent/50"
              }`}
            >
              <input
                type="checkbox"
                name="days"
                value={d.value}
                checked={selectedDays.includes(d.value)}
                onChange={() => toggleDay(d.value)}
                className="hidden"
              />
              {d.label}
            </label>
          ))}
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

      <div>
        <label className="mb-1.5 block text-sm font-medium">Vehicle (optional)</label>
        <select
          name="vehicle_id"
          defaultValue=""
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Unassigned</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Notes (optional)</label>
        <input
          name="notes"
          type="text"
          placeholder="e.g. Covers the downtown route"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
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
          {pending ? "Adding…" : "Add shift"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
