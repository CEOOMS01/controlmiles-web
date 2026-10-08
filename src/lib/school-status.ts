// School day colors (2026-10-09, user rule + 4 adjustments). Mirrors
// public.fn_rider_status in the database (migration
// 20261009130000_school_day_status), which clients can't call directly:
//   blue   = on track (picked up / dropped off as planned)
//   red    = alert: rode this morning but hasn't come out for the PM bus, or
//            boarded and the bus passed their stop without dropping them off
//   yellow = didn't ride this morning -> absent, not expected in the PM
//   gray   = red resolved with a reason (counts as attendance)
//   expected | pending | on_board = not decided yet

import type { SupabaseClient } from "@supabase/supabase-js";

export type RiderStatus = "blue" | "red" | "yellow" | "gray" | "expected" | "pending" | "on_board";

export const RELEASE_REASON_LABEL: Record<string, string> = {
  parent_pickup: "Picked up by a parent/guardian",
  early_dismissal: "Early dismissal (appointment)",
  activity: "After-school activity",
  other: "Other",
};

export const STATUS_PILL: Record<RiderStatus, string> = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700",
  red: "border-red-500/40 bg-red-500/10 text-red-700",
  yellow: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  gray: "border-slate-400/40 bg-slate-400/10 text-slate-600",
  expected: "border-border text-muted",
  pending: "border-border text-muted",
  on_board: "border-border text-muted",
};

type Assignment = { stop_id: string; student_id: string; action: string };
type Ride = { student_id: string; action: string; at: string; reason?: string | null; note?: string | null };

export type RiderState = { status: RiderStatus; at: string | null; reason: string | null; note: string | null };

/** Status of every assignment (`${student_id}:${action}`) in one run. */
export function runStatuses(input: {
  routeType: string;
  completed: boolean;
  reachedStops: Set<string>;
  assignments: Assignment[];
  rides: Ride[];
  rodeAm: (studentId: string) => boolean;
}): Map<string, RiderState> {
  const { routeType, completed, reachedStops, assignments, rides, rodeAm } = input;
  const ride = new Map(rides.map((r) => [`${r.student_id}:${r.action}`, r]));
  const pm = routeType === "school_pm";
  const out = new Map<string, RiderState>();
  for (const a of assignments) {
    const done = ride.get(`${a.student_id}:${a.action}`);
    const released = ride.get(`${a.student_id}:released`);
    const boarded = ride.has(`${a.student_id}:board`);
    const reached = reachedStops.has(a.stop_id);
    let status: RiderStatus;
    if (done) status = "blue";
    else if (released) status = "gray";
    else if (a.action === "board") {
      if (pm) status = !rodeAm(a.student_id) ? "yellow" : reached || completed ? "red" : "expected";
      else status = reached || completed ? "yellow" : "pending";
    } else if (!boarded) {
      if (pm) status = rodeAm(a.student_id) ? "pending" : "yellow";
      else {
        const pickupReached = assignments.some(
          (b) => b.student_id === a.student_id && b.action === "board" && reachedStops.has(b.stop_id),
        );
        status = completed || pickupReached ? "yellow" : "pending";
      }
    } else status = reached || completed ? "red" : "on_board";
    out.set(`${a.student_id}:${a.action}`, {
      status,
      at: done?.at ?? null,
      reason: released?.reason ?? null,
      note: released?.note ?? null,
    });
  }
  return out;
}

/** Students who boarded any of the fleet's AM school runs, keyed `${date}:${student_id}`. */
export async function loadRodeAm(
  supabase: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<Set<string>> {
  const { data: amRuns } = await supabase
    .from("route_runs")
    .select("id, run_date, routes!inner(route_type)")
    .eq("organization_id", orgId)
    .eq("routes.route_type", "school_am")
    .gte("run_date", from)
    .lte("run_date", to);
  if (!amRuns?.length) return new Set();
  const dateOf = new Map(amRuns.map((r) => [r.id, r.run_date as string]));
  const { data: boards } = await supabase
    .from("ridership_events")
    .select("run_id, student_id")
    .in("run_id", [...dateOf.keys()])
    .eq("action", "board");
  return new Set((boards ?? []).map((b) => `${dateOf.get(b.run_id)}:${b.student_id}`));
}
