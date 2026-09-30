// "What kind of fleet is it?" -- asked when a fleet is created (2026-09-29,
// industry templates: ask the business type up front like HubSpot/Jobber,
// then switch on only what fits). Submits `industry_template`; changeable
// later in Settings. Default General, so skipping it is harmless.

export const FLEET_TYPES = [
  {
    value: "general",
    title: "General fleet",
    body: "Delivery, service, sales or a mixed fleet.",
  },
  {
    value: "driving_school",
    title: "Driving school",
    body: "Adds hourly classes per instructor and vehicle.",
  },
] as const;

export function FleetTypePicker() {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">What kind of fleet is it?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {FLEET_TYPES.map((t, i) => (
          <label
            key={t.value}
            className="cursor-pointer rounded-lg border border-border p-3 text-sm transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="industry_template" value={t.value} defaultChecked={i === 0} />
              {t.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted">{t.body}</span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">You can change it anytime in Settings.</p>
    </fieldset>
  );
}

/** Server-side: the submitted value, or 'general' for anything else. */
export function fleetTypeFrom(formData: FormData): "general" | "driving_school" {
  return formData.get("industry_template") === "driving_school" ? "driving_school" : "general";
}
