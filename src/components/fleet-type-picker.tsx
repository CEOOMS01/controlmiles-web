"use client";

// "What kind of fleet is it?" -- the owner answers it once, right after
// sign-up and before the dashboard (2026-10-03: then it's locked; changes
// go through support). Nothing is preselected, so the type is always a
// real answer and never a default someone clicked past. Submits
// `industry_template`.

import { FLEET_PROFILES, type FleetProfile } from "@/lib/fleet-profiles";

export function FleetTypePicker({
  value,
  onChange,
  disabled,
}: {
  value: FleetProfile | null;
  onChange: (v: FleetProfile) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 block text-sm font-medium">What kind of fleet is it?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FLEET_PROFILES.map((t) => (
          <label
            key={t.value}
            className="cursor-pointer rounded-lg border border-border p-3 text-sm transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name="industry_template"
                value={t.value}
                required
                checked={value === t.value}
                onChange={() => onChange(t.value)}
              />
              {t.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{t.body}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
