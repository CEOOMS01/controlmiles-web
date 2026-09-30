// "What kind of fleet is it?" -- asked in onboarding, after sign-up
// (2026-09-30: one sign-up for everyone; the profile picks which modules
// show). Submits `industry_template`; changeable later in Settings.

import { FLEET_PROFILES, isFleetProfile, type FleetProfile } from "@/lib/fleet-profiles";

export function FleetTypePicker({ defaultValue = "delivery" }: { defaultValue?: FleetProfile }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">What kind of fleet is it?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FLEET_PROFILES.map((t) => (
          <label
            key={t.value}
            className="cursor-pointer rounded-lg border border-border p-3 text-sm transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="industry_template" value={t.value} defaultChecked={t.value === defaultValue} />
              {t.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{t.body}</span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        It only decides which tools show up first. You can change it, or show every module, anytime in Settings.
      </p>
    </fieldset>
  );
}

/** Server-side: the submitted profile, or 'general' for anything else. */
export function fleetTypeFrom(formData: FormData): FleetProfile {
  const v = formData.get("industry_template");
  return isFleetProfile(v) ? v : "general";
}
