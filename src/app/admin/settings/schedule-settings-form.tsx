"use client";

import { useActionState } from "react";
import { setScheduleSettings, type ScheduleSettingsState } from "./actions";

const initialState: ScheduleSettingsState = { error: null, success: false };

const US_ZONES = [
  { value: "America/New_York", label: "Eastern (New York, Miami)" },
  { value: "America/Chicago", label: "Central (Chicago, Houston)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix, no DST)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Puerto_Rico", label: "Puerto Rico" },
];

export function ScheduleSettingsForm({
  orgId,
  timezone,
  windowMinutes,
  showClassWindow,
}: {
  orgId: string;
  timezone: string;
  windowMinutes: number;
  // The class start window only exists for the Driving school template.
  showClassWindow: boolean;
}) {
  const [state, formAction, pending] = useActionState(setScheduleSettings, initialState);
  const zones = US_ZONES.some((z) => z.value === timezone)
    ? US_ZONES
    : [{ value: timezone, label: timezone }, ...US_ZONES];
  const field =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="org_id" value={orgId} />
      <p className="text-sm font-medium">{showClassWindow ? "Schedule & classes" : "Schedule"}</p>
      <p className="mt-1 text-sm text-muted">
        Shift times are your fleet&apos;s local time.
        {showClassWindow &&
          " The start window is how early and how late a driver can start a class; starting after its start time is marked late."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Fleet timezone</label>
          <select name="timezone" defaultValue={timezone} className={field}>
            {zones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
        <div className={showClassWindow ? "" : "hidden"}>
          <label className="mb-1.5 block text-sm font-medium">Class start window (minutes)</label>
          <input
            name="shift_start_window_minutes"
            type="number"
            min={0}
            max={120}
            defaultValue={windowMinutes}
            className={field}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {!pending && state.success && <p className="text-sm text-success">Saved.</p>}
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
