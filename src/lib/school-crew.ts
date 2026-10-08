// School route crew (2026-10-09): the bus, the driver and the bus monitor
// (aide, by name -- monitors usually don't use the app), shown together on
// the school pages of the dashboard.

import type { SupabaseClient } from "@supabase/supabase-js";
import { driverLabel, fleetDriverIds } from "./driver-label";

type Bus = { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null | undefined;

/** "Bus 7 · V-0012": the bus's name/number plus its fleet ID when it has one. */
export function busLabel(v: Bus, fallback = "No bus"): string {
  if (!v) return fallback;
  const name = v.nickname || [v.make, v.model].filter(Boolean).join(" ") || "Bus";
  return v.display_id && v.display_id !== name ? `${name} · ${v.display_id}` : name;
}

export type CrewOption = { id: string; label: string };

/** Active drivers and buses of the fleet, for the route's crew pickers. */
export async function loadCrewOptions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ drivers: CrewOption[]; vehicles: CrewOption[] }> {
  const [{ data: driverMembers }, { data: vehicles }, fleetIds] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
      .eq("member_role", "driver")
      .eq("is_active", true),
    supabase
      .from("vehicles")
      .select("id, nickname, make, model, display_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("nickname"),
    fleetDriverIds(supabase, orgId),
  ]);
  return {
    drivers: (driverMembers ?? []).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { id: m.user_id, label: driverLabel(p, fleetIds.get(m.user_id), p?.email || m.user_id) };
    }),
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, label: busLabel(v) })),
  };
}
