// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-profiles.ts
//
// Fleet profiles (the "service" a fleet picks once in onboarding). Since
// 2026-10-19 the service and the plan together decide what a fleet has,
// in the database (fn_org_features, see src/lib/fleet-features.ts) -- a
// module outside them is not shown anywhere and is refused by the server.
// Mirrors the organizations_industry_template_check constraint and
// fn_profile_requires_pretrip in the database.

export const FLEET_PROFILES = [
  { value: "delivery", title: "Delivery & courier", body: "Last-mile, couriers, food and parcel delivery." },
  { value: "field_service", title: "Field service", body: "HVAC, plumbing, electrical, pest control, landscaping." },
  { value: "trucking", title: "Trucking & freight", body: "Heavy trucks, interstate freight, owner-operators. Includes IFTA." },
  { value: "construction", title: "Construction", body: "Pickups and heavy trucks moving between job sites." },
  { value: "passenger", title: "Passenger transport", body: "Shuttles, medical transport, charters." },
  { value: "school_transport", title: "School transportation", body: "Student routes with stops, schools and riders, live." },
  { value: "sales", title: "Sales & company cars", body: "Sales reps and employees driving company cars." },
  { value: "driving_school", title: "Driving school", body: "Classes per instructor and car, students and their hours." },
  { value: "general", title: "Mixed / other", body: "A bit of everything: IFTA, owner-operators, routes and geofences." },
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

/** What a service includes beyond the base plan -- shown before the owner confirms it (it's locked afterwards). Mirrors fn_org_feature_list_internal. */
const SERVICE_EXTRAS: Record<FleetProfile, { starter: string[]; growth: string[]; enterprise?: string[] }> = {
  delivery: { starter: ["Owner-operator vehicles"], growth: ["Routes", "Geofences"] },
  field_service: { starter: [], growth: ["Routes", "Geofences"] },
  trucking: { starter: ["IFTA fuel-tax reports", "Owner-operator vehicles"], growth: ["Routes", "Geofences"] },
  construction: { starter: ["IFTA fuel-tax reports"], growth: ["Routes", "Geofences"] },
  passenger: { starter: [], growth: ["Routes", "Geofences"] },
  school_transport: {
    starter: ["School routes with stops", "Schools and students", "Attendance", "Bus aides", "Live map of your drivers"],
    growth: ["Live run board", "Substitute crew for the day", "Attendance export", "Geofences"],
  },
  sales: { starter: [], growth: ["Geofences", "Trip approval"] },
  driving_school: {
    starter: ["Live map of your drivers"],
    growth: ["Hourly classes per instructor and car", "Day schedule", "Students and their hours"],
    enterprise: ["Report cards", "Parent portal", "Class reminders", "Packages", "Sealed certificates"],
  },
  general: { starter: ["IFTA fuel-tax reports", "Owner-operator vehicles"], growth: ["Routes", "Geofences"] },
};

// Mirrors fn_profile_requires_pretrip in the database.
const PRETRIP_BY_DEFAULT: ReadonlySet<FleetProfile> = new Set(["general", "trucking", "construction", "passenger", "school_transport"]);

/** What a fleet type includes, per plan -- shown before the owner confirms it. */
export function profileSummary(profile: FleetProfile): string[] {
  const { starter, growth, enterprise } = SERVICE_EXTRAS[profile];
  const lines = [...starter];
  if (growth.length) lines.push(`With Growth: ${growth.join(", ").toLowerCase()}`);
  if (enterprise?.length) lines.push(`With Enterprise: ${enterprise.join(", ").toLowerCase()}`);
  lines.push(PRETRIP_BY_DEFAULT.has(profile) ? "Daily pre-trip inspection required" : "Pre-trip inspection optional");
  return lines;
}
