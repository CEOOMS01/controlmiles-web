// School transportation (2026-10-09): today's live run board. Every school
// route scheduled today, with its state -- not started (late if past its
// start), in progress (next stop, minutes behind, students on board) or
// completed (with the "no child left on board" check) -- next to the live
// map of the buses.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { ROUTE_TYPE_LABEL, clock, fleetNow, minutesOf } from "@/lib/school";
import { dueStopIds, loadRodeAm, runStatuses } from "@/lib/school-status";
import { busLabel, effectiveMonitor, loadCrewOptions, loadCrewOverrides } from "@/lib/school-crew";
import { FleetMap, type FleetVehicle } from "../fleet-map";
import { AutoRefresh } from "./auto-refresh";

type Card = {
  id: string;
  name: string;
  type: string;
  driver: string;
  bus: string;
  monitor: string | null;
  substitute: boolean;
  start: string | null;
  state: "not_started" | "late_start" | "on_time" | "behind" | "completed";
  detail: string;
  progress: string;
  onBoard: number;
  riders: number;
  alerts: number; // red riders (lib/school-status)
};

const STATE_STYLE: Record<Card["state"], { label: string; className: string }> = {
  not_started: { label: "Not started", className: "bg-border text-muted" },
  late_start: { label: "Late start", className: "bg-danger/15 text-danger" },
  on_time: { label: "On time", className: "bg-success/15 text-success" },
  behind: { label: "Behind", className: "bg-amber-500/15 text-amber-600" },
  completed: { label: "Completed", className: "bg-accent/15 text-accent" },
};

const LATE_MIN = 5;

export default async function SchoolLivePage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const [{ data: org }, { data: me }] = await Promise.all([
    supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle(),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
  ]);
  const tz = org?.timezone ?? "America/New_York";
  const timeFormat: "12h" | "24h" = me?.time_format === "24h" ? "24h" : "12h";
  const now = fleetNow(tz);

  const { data: routeRows } = await supabase
    .from("routes")
    .select(
      "id, name, route_type, service_days, scheduled_start_time, assigned_driver_id, assigned_vehicle_id, monitor_id, monitor_name, profiles!routes_assigned_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id)",
    )
    .eq("organization_id", orgId)
    .in("route_type", ["school_am", "school_pm"])
    .eq("status", "active")
    .contains("service_days", [now.isoDow])
    .order("scheduled_start_time", { ascending: true, nullsFirst: false });
  const routes = routeRows ?? [];
  const routeIds = routes.map((r) => r.id);

  const [{ data: runs }, { data: stops }, { data: assignments }, { data: mapVehicles }, fleetIds] = await Promise.all([
    routeIds.length
      ? supabase
          .from("route_runs")
          .select("id, route_id, status, started_at, completed_at, child_check_at, vehicle_id")
          .eq("run_date", now.date)
          .in("route_id", routeIds)
      : Promise.resolve({ data: [] }),
    routeIds.length
      ? supabase.from("route_stops").select("id, route_id, seq, name, scheduled_time").in("route_id", routeIds).order("seq")
      : Promise.resolve({ data: [] }),
    routeIds.length
      ? supabase.from("student_stop_assignments").select("route_id, stop_id, student_id, action").in("route_id", routeIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("vehicles")
      .select("id, nickname, display_id, last_latitude, last_longitude, last_speed, last_location_at, active_session_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .not("last_latitude", "is", null),
    fleetDriverIds(supabase, orgId),
  ]);
  const runIds = (runs ?? []).map((r) => r.id);
  const [overrides, crewOptions] = await Promise.all([
    loadCrewOverrides(supabase, routeIds, now.date),
    loadCrewOptions(supabase, orgId),
  ]);
  const crewLabel = new Map(
    [...crewOptions.drivers, ...crewOptions.monitors, ...crewOptions.vehicles].map((o) => [o.id, o.label]),
  );
  const [{ data: events }, { data: ridership }, rodeAm] = await Promise.all([
    runIds.length
      ? supabase.from("route_stop_events").select("run_id, stop_id, arrived_at, departed_at").in("run_id", runIds)
      : Promise.resolve({ data: [] }),
    runIds.length
      ? supabase.from("ridership_events").select("run_id, student_id, action, at").in("run_id", runIds)
      : Promise.resolve({ data: [] }),
    loadRodeAm(supabase, orgId, now.date, now.date),
  ]);

  const runByRoute = new Map((runs ?? []).map((r) => [r.route_id, r]));
  const cards: Card[] = routes.map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
    const run = runByRoute.get(r.id);
    const routeStops = (stops ?? []).filter((s) => s.route_id === r.id);
    const visited = new Set((events ?? []).filter((e) => run && e.run_id === run.id).map((e) => e.stop_id));
    const riders = (assignments ?? []).filter((a) => a.route_id === r.id && a.action === "board").length;
    const rides = (ridership ?? []).filter((e) => run && e.run_id === run.id);
    const onBoard = rides.filter((e) => e.action === "board").length - rides.filter((e) => e.action === "alight").length;
    const alerts = run
      ? [
          ...runStatuses({
            routeType: r.route_type,
            completed: run.status === "completed",
            dueStops: dueStopIds((events ?? []).filter((e) => e.run_id === run.id)),
            assignments: (assignments ?? []).filter((a) => a.route_id === r.id),
            rides,
            rodeAm: (studentId) => rodeAm.has(`${now.date}:${studentId}`),
          }).values(),
        ].filter((x) => x.status === "red").length
      : 0;

    let state: Card["state"] = "not_started";
    let detail = r.scheduled_start_time ? `Starts ${clock(r.scheduled_start_time, timeFormat)}` : "No start time";
    if (!run) {
      if (r.scheduled_start_time && now.minutes > minutesOf(r.scheduled_start_time) + LATE_MIN) {
        state = "late_start";
        detail = `Should have started at ${clock(r.scheduled_start_time, timeFormat)} · tap to assign a substitute`;
      }
    } else if (run.status === "completed") {
      state = "completed";
      detail = run.child_check_at
        ? `Finished ${new Date(run.completed_at!).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })} · child check ✓`
        : "Finished";
    } else {
      const next = routeStops.find((s) => !visited.has(s.id));
      state = "on_time";
      if (!next) {
        detail = "All stops visited · waiting for the child check";
      } else {
        const behind = next.scheduled_time ? now.minutes - minutesOf(next.scheduled_time) : 0;
        if (behind > LATE_MIN) state = "behind";
        detail = `Next: ${next.name}${next.scheduled_time ? ` (${clock(next.scheduled_time, timeFormat)})` : ""}${
          behind > LATE_MIN ? ` · ${behind} min behind` : ""
        }`;
      }
    }

    return {
      id: r.id,
      name: r.name,
      type: ROUTE_TYPE_LABEL[r.route_type] ?? "",
      // Today's substitute (route_crew_overrides) wins over the regular crew.
      ...(() => {
        const o = overrides.get(r.id);
        return {
          driver: o?.driver_id
            ? (crewLabel.get(o.driver_id) ?? "Substitute")
            : driverLabel(p, r.assigned_driver_id ? fleetIds.get(r.assigned_driver_id) : null, "No driver"),
          bus: o?.vehicle_id ? (crewLabel.get(o.vehicle_id) ?? "Substitute bus") : busLabel(v),
          monitor: effectiveMonitor(r, o, (id) => crewLabel.get(id)).text,
          substitute: Boolean(o),
        };
      })(),
      start: r.scheduled_start_time,
      state,
      detail,
      progress: `${routeStops.filter((s) => visited.has(s.id)).length}/${routeStops.length} stops`,
      onBoard: Math.max(0, onBoard),
      riders,
      alerts,
    };
  });

  const vehicles: FleetVehicle[] = (mapVehicles ?? []).map((v) => ({
    id: v.id,
    displayId: v.display_id,
    label: v.nickname || v.display_id || "Bus",
    lat: v.last_latitude as number,
    lon: v.last_longitude as number,
    speed: v.last_speed,
    lastLocationAt: v.last_location_at,
    onTrip: v.active_session_id != null,
  }));

  const counts = {
    running: cards.filter((c) => c.state === "on_time" || c.state === "behind").length,
    attention: cards.filter((c) => c.state === "late_start" || c.state === "behind" || c.alerts > 0).length,
    done: cards.filter((c) => c.state === "completed").length,
  };

  return (
    <main className="space-y-6 px-6 py-10 sm:px-10">
      <AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">School transportation</p>
          <h1 className="mt-1 text-2xl font-semibold">Today&apos;s routes</h1>
          <p className="mt-1 text-sm text-muted">
            {cards.length} scheduled · {counts.running} running · {counts.done} completed
            {counts.attention > 0 && <span className="text-danger"> · {counts.attention} need attention</span>}
          </p>
        </div>
        <Link
          href="/admin/school/routes"
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent"
        >
          Manage routes
        </Link>
      </div>

      <FleetMap orgId={orgId} initialVehicles={vehicles} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/admin/school/live/${c.id}`}
            className="rounded-xl border border-border bg-surface p-4 transition hover:border-accent/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted">{c.type}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLE[c.state].className}`}>
                {STATE_STYLE[c.state].label}
              </span>
            </div>
            <p className="mt-3 text-sm">{c.detail}</p>
            {c.alerts > 0 && (
              <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                {c.alerts} student{c.alerts > 1 ? "s" : ""} in red: rode this morning but not on the bus / not dropped off
              </p>
            )}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
              <dt className="text-muted">Bus</dt>
              <dd className="font-medium">{c.bus}</dd>
              <dt className="text-muted">Driver</dt>
              <dd className="font-medium">{c.driver}</dd>
              <dt className="text-muted">Monitor</dt>
              <dd className="font-medium">{c.monitor ?? "—"}</dd>
            </dl>
            {c.substitute && (
              <p className="mt-1 text-[11px] font-semibold text-amber-700 uppercase">Substitute crew today</p>
            )}
            <p className="mt-1 text-xs text-muted">
              {c.progress} · {c.onBoard} on board · {c.riders} riders assigned
            </p>
          </Link>
        ))}
        {cards.length === 0 && (
          <p className="text-sm text-muted">
            No school routes run today. Create them in{" "}
            <Link href="/admin/school/routes" className="text-accent hover:underline">
              School routes
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
