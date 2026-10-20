// Olympus Mont Systems LLC - ControlMiles Web
// src/lib/fleet-features.ts
//
// What an organization has, from its service (industry_template) and its
// plan (2026-10-19, user-approved table). The list comes from the database
// (fn_org_features), which also enforces it in RLS and RPCs -- the web only
// reads it to decide what to show. A feature outside the list is not shown
// anywhere: no menu item, no card, and its page answers 404.

import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";

export type FleetFeature =
  | "dvir"
  | "owner_operators"
  | "ifta"
  | "school"
  | "school_live"
  | "classes"
  | "live_map"
  | "fleet_export"
  | "activity_log"
  | "safety_scores"
  | "fuel_alerts"
  | "shift_schedules"
  | "open_assignment"
  | "routes"
  | "geofences"
  | "trip_approval"
  | "students"
  | "student_evaluations"
  | "student_portal"
  | "class_reminders"
  | "student_packages"
  | "student_certificates"
  | "student_booking"
  | "state_records"
  | "sms_reminders";

export type FeatureSet = { has: (f: FleetFeature) => boolean; list: FleetFeature[] };

/** Features of one org, deduped per request. Empty for a non-member or an org without a plan. */
export const getOrgFeatures = cache(async (orgId: string): Promise<FeatureSet> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_org_features", { p_org_id: orgId });
  const list = (Array.isArray(data) ? data : []) as FleetFeature[];
  const set = new Set(list);
  return { has: (f) => set.has(f), list };
});

/** The signed-in admin's current org features. */
export async function getMyOrgFeatures(): Promise<{ orgId: string | null; features: FeatureSet }> {
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id ?? null;
  if (!orgId) return { orgId: null, features: { has: () => false, list: [] } };
  return { orgId, features: await getOrgFeatures(orgId) };
}

/** Page guard: a page whose feature the org doesn't have doesn't exist for it. */
export async function requireFeature(...anyOf: FleetFeature[]): Promise<FeatureSet> {
  const { features } = await getMyOrgFeatures();
  if (!anyOf.some((f) => features.has(f))) notFound();
  return features;
}
