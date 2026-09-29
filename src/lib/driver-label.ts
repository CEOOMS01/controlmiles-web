import type { SupabaseClient } from "@supabase/supabase-js";

type NameParts = { first_name: string | null; last_name: string | null } | null | undefined;

/**
 * Fleet login IDs (CM-D####) by user id for one org. They live only on
 * fleet_driver_slots (claimed_by) -- profiles.display_id is a different,
 * personal gig ID and must never be shown as a driver's fleet ID (see
 * roster/page.tsx).
 */
export async function fleetDriverIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("fleet_driver_slots")
    .select("claimed_by, display_id")
    .eq("organization_id", orgId)
    .not("claimed_by", "is", null);
  return new Map(
    (data ?? [])
      .filter((s) => s.claimed_by && s.display_id)
      .map((s) => [s.claimed_by as string, s.display_id as string]),
  );
}

/**
 * How a driver reads everywhere in the dashboard (user rule, 2026-09-29):
 * "Name / ID". Falls back to whichever half exists.
 */
export function driverLabel(p: NameParts, fleetId?: string | null, fallback = "—"): string {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  if (name && fleetId) return `${name} / ${fleetId}`;
  return name || fleetId || fallback;
}
