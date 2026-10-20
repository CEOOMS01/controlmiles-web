"use client";

import { SaveStatus, SettingRow, UnitInput, settingsField } from "@/components/settings-ui";

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

  return (
    <form action={formAction} className="divide-y divide-border">
      <input type="hidden" name="org_id" value={orgId} />
      <SettingRow
        title="Time zone"
        help={showClassWindow ? "Schedules, classes and reports use your fleet's local time." : "Schedules and reports use your fleet's local time."}
      >
        <select name="timezone" defaultValue={timezone} aria-label="Time zone" className={`${settingsField} sm:w-64`}>
          {zones.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      </SettingRow>
      {showClassWindow ? (
        <SettingRow
          title="Class start window"
          help="How early or late an instructor can start a class; starting after its start time is marked late."
        >
          <UnitInput name="shift_start_window_minutes" defaultValue={windowMinutes} unit="minutes" min={0} max={120} />
        </SettingRow>
      ) : (
        <input type="hidden" name="shift_start_window_minutes" value={windowMinutes} />
      )}
      <div className="flex items-center justify-end gap-3 py-3">
        <SaveStatus pending={false} success={!pending && state.success} error={state.error} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
