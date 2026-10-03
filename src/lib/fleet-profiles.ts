// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-profiles.ts
//
// Fleet profiles (2026-09-30, approved plan): the profile chosen in
// onboarding hides the modules that don't apply to that kind of fleet --
// a car fleet doesn't see IFTA -- and never blocks anything: Settings has
// "Show all modules", and pages stay reachable by URL. The plan
// (Starter/Growth/Enterprise) separately decides depth. Mirrors the
// organizations_industry_template_check constraint and
// fn_profile_requires_pretrip in the database.

export const FLEET_PROFILES = [
  { value: "delivery", title: "Delivery & courier", body: "Last-mile, couriers, food and parcel delivery." },
  { value: "field_service", title: "Field service", body: "HVAC, plumbing, electrical, pest control, landscaping." },
  { value: "trucking", title: "Trucking & freight", body: "Heavy trucks, interstate freight, owner-operators. Includes IFTA." },
  { value: "construction", title: "Construction", body: "Pickups and heavy trucks moving between job sites." },
  { value: "passenger", title: "Passenger transport", body: "Shuttles, school buses, medical transport." },
  { value: "sales", title: "Sales & company cars", body: "Sales reps and employees driving company cars." },
  { value: "driving_school", title: "Driving school", body: "Adds hourly classes per instructor and vehicle." },
  { value: "general", title: "Mixed / other", body: "A bit of everything. Shows every module." },
] as const;

export type FleetProfile = (typeof FLEET_PROFILES)[number]["value"];

export function isFleetProfile(v: unknown): v is FleetProfile {
  return FLEET_PROFILES.some((p) => p.value === v);
}

/** Server-side: the submitted profile, or null when none was picked. */
export function fleetTypeFrom(formData: FormData): FleetProfile | null {
  const v = formData.get("industry_template");
  return isFleetProfile(v) ? v : null;
}

export function profileTitle(v: string | null | undefined): string {
  return FLEET_PROFILES.find((p) => p.value === v)?.title ?? "Mixed / other";
}

/** Modules a profile can hide. Everything else is shown to every fleet. */
export type OptionalModule = "ifta" | "routes" | "geofences" | "owner_operators";

const MODULES_BY_PROFILE: Record<FleetProfile, OptionalModule[]> = {
  general: ["ifta", "routes", "geofences", "owner_operators"],
  delivery: ["routes", "geofences", "owner_operators"],
  field_service: ["routes", "geofences"],
  trucking: ["ifta", "routes", "geofences", "owner_operators"],
  construction: ["ifta", "routes", "geofences"],
  passenger: ["routes", "geofences"],
  sales: ["geofences"],
  driving_school: [],
};

const MODULE_LABELS: Record<OptionalModule, string> = {
  ifta: "IFTA fuel-tax reports",
  routes: "Routes",
  geofences: "Geofences",
  owner_operators: "Owner-operator vehicles",
};

// Mirrors fn_profile_requires_pretrip in the database.
const PRETRIP_BY_DEFAULT: ReadonlySet<FleetProfile> = new Set(["general", "trucking", "construction", "passenger"]);

/** What a fleet type turns on -- shown before the owner confirms it (it's locked afterwards). */
export function profileSummary(profile: FleetProfile): string[] {
  const lines = MODULES_BY_PROFILE[profile].map((m) => MODULE_LABELS[m]);
  if (profile === "driving_school") lines.push("Hourly classes per instructor and vehicle");
  lines.push(PRETRIP_BY_DEFAULT.has(profile) ? "Daily pre-trip inspection required" : "Pre-trip inspection optional");
  return lines;
}

export function moduleVisible(
  profile: string | null | undefined,
  showAll: boolean | null | undefined,
  module: OptionalModule,
): boolean {
  if (showAll) return true;
  const p: FleetProfile = isFleetProfile(profile) ? profile : "general";
  return MODULES_BY_PROFILE[p].includes(module);
}
