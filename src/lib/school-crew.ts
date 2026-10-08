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

/**
 * Active members (drivers first; a manager who drives can be picked too, tagged
 * with their role) and buses of the fleet, for the route's crew pickers.
 */
export async function loadCrewOptions(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ drivers: CrewOption[]; vehicles: CrewOption[] }> {
  const [{ data: driverMembers }, { data: vehicles }, fleetIds] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, member_role, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
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
    drivers: (driverMembers ?? [])
      .map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        const label = driverLabel(p, fleetIds.get(m.user_id), p?.email || m.user_id);
        return { id: m.user_id, label: m.member_role === "driver" ? label : `${label} (${m.member_role})`, driver: m.member_role === "driver" };
      })
      .sort((a, b) => Number(b.driver) - Number(a.driver) || a.label.localeCompare(b.label))
      .map(({ id, label }) => ({ id, label })),
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, label: busLabel(v) })),
  };
}

export type CrewOverride = {
  route_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  monitor_name: string | null;
  reason: string | null;
};

/** The day's substitutes (route_crew_overrides) by route. */
export async function loadCrewOverrides(
  supabase: SupabaseClient,
  routeIds: string[],
  date: string,
): Promise<Map<string, CrewOverride>> {
  if (!routeIds.length) return new Map();
  const { data } = await supabase
    .from("route_crew_overrides")
    .select("route_id, driver_id, vehicle_id, monitor_name, reason")
    .in("route_id", routeIds)
    .eq("service_date", date);
  return new Map((data ?? []).map((o) => [o.route_id, o]));
}
