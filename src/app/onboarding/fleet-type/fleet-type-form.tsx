"use client";

import { useActionState, useState } from "react";
import { FleetTypePicker } from "@/components/fleet-type-picker";
import { profileSummary, profileTitle, type FleetProfile } from "@/lib/fleet-profiles";
import { chooseFleetType, type FleetTypeState } from "./actions";

const initialState: FleetTypeState = { error: null };

// Pick -> see what it turns on -> confirm (it's locked afterwards, same as
// a business category at Square or the carrier setup at Motive).
export function FleetTypeForm() {
  const [state, formAction, pending] = useActionState(chooseFleetType, initialState);
  const [type, setType] = useState<FleetProfile | null>(null);
  const [understood, setUnderstood] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <FleetTypePicker
        value={type}
        onChange={(v) => {
          setType(v);
          setUnderstood(false);
        }}
        disabled={pending}
      />

      {type && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">{profileTitle(type)} turns on:</p>
          <ul className="mt-2 space-y-1 text-muted">
            {profileSummary(type).map((line) => (
              <li key={line}>• {line}</li>
            ))}
            <li>• Plus what every fleet gets with its plan: roster, GPS trips, odometer photos, reports</li>
          </ul>
          <p className="mt-3 text-xs text-muted">
            You can still show every module and change the pre-trip and shift settings anytime in Settings.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              name="confirm_locked"
              checked={understood}
              onChange={(e) => setUnderstood(e.currentTarget.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-xs">
              I understand the fleet type is set for this fleet. Changing it later requires contacting support.
            </span>
          </label>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !type || !understood}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : type ? `Confirm: ${profileTitle(type)}` : "Choose your fleet type"}
      </button>
    </form>
  );
}
