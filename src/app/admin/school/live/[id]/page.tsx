// School: live -> one route today (2026-10-09, owner's request): every
// student of the route with ONE color for their situation right now (blue on
// track, red alert, yellow absent, gray released with a reason, neutral not
// decided yet), plus the bus, the driver and the bus monitor (today's
// substitute when there is one, with the form to assign it), and who marked
// each student. Alerts first.
// Refreshes every 15 s while the route runs. Planning lives on
// /admin/school/routes/[id].

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { ROUTE_TYPE_LABEL, clock, fleetNow, minutesOf } from "@/lib/school";
import { busLabel, effectiveMonitor, loadCrewOptions, loadCrewOverrides } from "@/lib/school-crew";
import {
  RELEASE_REASON_LABEL,
  STATUS_PILL,
  dueStopIds,
  loadRodeAm,
  runStatuses,
  type RiderState,
  type RiderStatus,
} from "@/lib/school-status";
import { AutoRefresh } from "../../auto-refresh";
import { SubstituteForm } from "../../substitute-form";

// Display order: what needs someone's attention first.
const ORDER: RiderStatus[] = ["red", "expected", "pending", "on_board", "blue", "gray", "yellow"];

const LEGEND: { status: RiderStatus; label: string }[] = [
  { status: "blue", label: "On track" },
  { status: "red", label: "Alert — check now" },
  { status: "yellow", label: "Absent" },
  { status: "gray", label: "Released with a reason" },
  { status: "pending", label: "Not decided yet" },
];

export default async function SchoolLiveRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const [{ data: route }, { data: org }] = await Promise.all([
    supabase
      .from("routes")
      .select(
        "id, name, route_type, school_site_id, scheduled_start_time, assigned_driver_id, monitor_id, monitor_name, profiles!routes_assigned_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id, plate)",
      )
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle(),
  ]);
  if (!route || (route.route_type !== "school_am" && route.route_type !== "school_pm")) notFound();
  const tz = org?.timezone ?? "America/New_York";
  const now = fleetNow(tz);
  const today = now.date;
  const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

  const [{ data: run }, { data: stops }, { data: assignments }, { data: school }, fleetIds, rodeAm, overrides, crewOptions] = await Promise.all([
    supabase
      .from("route_runs")
      .select("id, status, started_at, completed_at, child_check_at")
      .eq("route_id", id)
      .eq("run_date", today)
      .maybeSingle(),
    supabase.from("route_stops").select("id, seq, name").eq("route_id", id).order("seq"),
    supabase.from("student_stop_assignments").select("stop_id, student_id, action").eq("route_id", id),
    route.school_site_id
      ? supabase.from("school_sites").select("name").eq("id", route.school_site_id).maybeSingle()
      : Promise.resolve({ data: null }),
    fleetDriverIds(supabase, orgId),
    loadRodeAm(supabase, orgId, today, today),
    loadCrewOverrides(supabase, [id], today),
    loadCrewOptions(supabase, orgId),
  ]);
  const sub = overrides.get(id) ?? null;
  const studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];
  const [{ data: students }, { data: events }, { data: rides }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, first_name, last_initial, grade, is_active").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    run
      ? supabase.from("route_stop_events").select("stop_id, arrived_at, departed_at").eq("run_id", run.id)
      : Promise.resolve({ data: [] }),
    run
      ? supabase.from("ridership_events").select("student_id, action, at, reason, note, recorded_by").eq("run_id", run.id)
      : Promise.resolve({ data: [] }),
  ]);
  // Names: who marked each student, and today's substitute driver / bus.
  const peopleIds = [
    ...new Set([...(rides ?? []).map((r) => r.recorded_by), sub?.driver_id].filter((x): x is string => Boolean(x))),
  ];
  const [{ data: people }, { data: subBus }] = await Promise.all([
    peopleIds.length
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", peopleIds)
      : Promise.resolve({ data: [] }),
    sub?.vehicle_id
      ? supabase.from("vehicles").select("nickname, make, model, display_id, plate").eq("id", sub.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const personName = new Map(
    (people ?? []).map((x) => [x.id, [x.first_name, x.last_name].filter(Boolean).join(" ") || "Crew member"]),
  );
  const markedBy = (studentId: string, action: string) => {
    const by = (rides ?? []).find((r) => r.student_id === studentId && r.action === action)?.recorded_by;
    return by ? (personName.get(by) ?? null) : null;
  };

  const pm = route.route_type === "school_pm";
  const statuses = runStatuses({
    routeType: route.route_type,
    completed: run?.status === "completed",
    dueStops: dueStopIds(events ?? []),
    assignments: assignments ?? [],
    rides: rides ?? [],
    rodeAm: (studentId) => rodeAm.has(`${today}:${studentId}`),
  });
  const stopName = new Map((stops ?? []).map((s) => [s.id, `${s.seq}. ${s.name}`]));
  const none: RiderState = { status: "pending", at: null, reason: null, note: null };

  // One color per student: the board and drop-off statuses combined.
  const rows = (students ?? [])
    .filter((st) => st.is_active)
    .map((st) => {
      const on = (assignments ?? []).find((a) => a.student_id === st.id && a.action === "board");
      const off = (assignments ?? []).find((a) => a.student_id === st.id && a.action === "alight");
      const b = statuses.get(`${st.id}:board`) ?? none;
      const a = statuses.get(`${st.id}:alight`) ?? none;
      const onStop = on ? (stopName.get(on.stop_id) ?? "") : "";
      const offStop = off ? (stopName.get(off.stop_id) ?? "") : "";
      let status: RiderStatus;
      let situation: string;
      if (b.status === "red") {
        status = "red";
        situation = "Rode this morning but hasn't come out — check at the school";
      } else if (a.status === "red") {
        status = "red";
        situation = `Not dropped off at ${offStop} — still on the bus?`;
      } else if (b.status === "gray") {
        status = "gray";
        situation = `Released: ${RELEASE_REASON_LABEL[b.reason ?? "other"] ?? b.reason}${b.note ? ` (${b.note})` : ""}`;
      } else if (b.status === "yellow") {
        status = "yellow";
        situation = pm ? "Absent today — didn't ride this morning" : "Absent — not picked up";
      } else if (b.status === "blue" && a.status === "blue") {
        status = "blue";
        situation = `Dropped off${a.at ? ` at ${hm(a.at)}` : ""}`;
      } else if (b.status === "blue") {
        status = "blue";
        situation = `On the bus — picked up${b.at ? ` at ${hm(b.at)}` : ""}`;
      } else if (b.status === "expected") {
        status = "expected";
        situation = "Rode this morning — expected on the bus";
      } else {
        status = "pending";
        situation = `Waiting at ${onStop}`;
      }
      return {
        id: st.id,
        name: `${st.first_name}${st.last_initial ? ` ${st.last_initial}.` : ""}`,
        grade: st.grade,
        status,
        situation,
        onStop,
        offStop,
        onAt: b.status === "blue" ? b.at : null,
        offAt: a.status === "blue" ? a.at : null,
        onBy: b.status === "blue" ? markedBy(st.id, "board") : b.status === "gray" ? markedBy(st.id, "released") : null,
        offBy: a.status === "blue" ? markedBy(st.id, "alight") : null,
      };
    })
    .sort((x, y) => ORDER.indexOf(x.status) - ORDER.indexOf(y.status) || x.name.localeCompare(y.name));

  const count = (s: RiderStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const p = Array.isArray(route.profiles) ? route.profiles[0] : route.profiles;
  const v = Array.isArray(route.vehicles) ? route.vehicles[0] : route.vehicles;
  const regularDriver = driverLabel(p, route.assigned_driver_id ? fleetIds.get(route.assigned_driver_id) : null, "No driver");
  const driverText = sub?.driver_id
    ? sub.driver_id === route.assigned_driver_id
      ? regularDriver
      : `${personName.get(sub.driver_id) ?? "Substitute"}${fleetIds.get(sub.driver_id) ? ` / ${fleetIds.get(sub.driver_id)}` : ""}`
    : regularDriver;
  const bus = sub?.vehicle_id ? subBus : v;
  const monitorLabel = (mid: string) => crewOptions.monitors.find((m) => m.id === mid)?.label;
  const monitor = effectiveMonitor(route, sub, monitorLabel);
  const regularMonitor = effectiveMonitor(route, null, monitorLabel);
  const lateStart =
    !run && route.scheduled_start_time != null && now.minutes > minutesOf(route.scheduled_start_time) + 5;
  const runState = !run
    ? "Not started today"
    : run.status === "completed"
      ? `Completed at ${hm(run.completed_at!)}${run.child_check_at ? " · child check ✓" : ""}`
      : `Running since ${hm(run.started_at)}`;

  return (
    <main className="space-y-6 px-6 py-10 sm:px-10">
      {run?.status === "in_progress" && <AutoRefresh seconds={15} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/school" className="text-sm text-muted hover:text-accent">
            ← School: live
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{route.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {ROUTE_TYPE_LABEL[route.route_type]}
            {school?.name ? ` · ${school.name}` : ""} · {today} · {runState}
          </p>
        </div>
        <Link
          href={`/admin/school/routes/${id}`}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent"
        >
          Route setup
        </Link>
      </div>

      {lateStart && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700">
          Late start: this route should have started at {clock(route.scheduled_start_time, "12h")}. Assign a substitute
          below if the driver isn&apos;t here.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Bus{sub?.vehicle_id && <SubTag />}</p>
          <p className="text-lg font-semibold">{busLabel(bus)}</p>
          {bus?.plate && <p className="text-xs text-muted">Plate {bus.plate}</p>}
          {sub?.vehicle_id && <p className="text-xs text-muted">Regular: {busLabel(v)}</p>}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Driver{sub?.driver_id && <SubTag />}</p>
          <p className="text-lg font-semibold">{driverText}</p>
          {sub?.driver_id && <p className="text-xs text-muted">Regular: {regularDriver}</p>}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Bus monitor{monitor.substitute && <SubTag />}</p>
          <p className="text-lg font-semibold">{monitor.text ?? "None assigned"}</p>
          <p className="text-xs text-muted">
            {monitor.text ? (monitor.inApp ? "Uses the app" : "No app (by name)") : ""}
            {monitor.substitute && ` · Regular: ${regularMonitor.text ?? "none"}`}
          </p>
        </div>
      </div>
      {sub?.reason && <p className="text-sm text-muted">Substitute today: {sub.reason}</p>}
      {run?.status !== "completed" && (
        <SubstituteForm
          routeId={id}
          date={today}
          drivers={crewOptions.drivers}
          monitors={crewOptions.monitors}
          vehicles={crewOptions.vehicles}
          current={sub}
          startOpen={lateStart}
        />
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`rounded-full border px-3 py-1 font-semibold ${STATUS_PILL.blue}`}>{count(["blue"])} on track</span>
        <span className={`rounded-full border px-3 py-1 font-semibold ${STATUS_PILL.red}`}>{count(["red"])} alerts</span>
        <span className={`rounded-full border px-3 py-1 font-semibold ${STATUS_PILL.yellow}`}>{count(["yellow"])} absent</span>
        <span className={`rounded-full border px-3 py-1 font-semibold ${STATUS_PILL.gray}`}>{count(["gray"])} released</span>
        <span className={`rounded-full border px-3 py-1 font-semibold ${STATUS_PILL.pending}`}>
          {count(["expected", "pending", "on_board"])} not decided yet
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Situation</th>
              <th className="px-4 py-3 font-medium">Gets on</th>
              <th className="px-4 py-3 font-medium">Gets off</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  {r.grade && <p className="text-xs text-muted">Grade {r.grade}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[r.status]}`}>
                    {r.situation}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {r.onStop || "—"}
                  {r.onAt && <span className="block text-xs">{hm(r.onAt)}</span>}
                  {r.onBy && <span className="block text-xs">by {r.onBy}</span>}
                </td>
                <td className="px-4 py-3 text-muted">
                  {r.offStop || "—"}
                  {r.offAt && <span className="block text-xs">{hm(r.offAt)}</span>}
                  {r.offBy && <span className="block text-xs">by {r.offBy}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  No students on this route yet. Add them in Route setup.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-full border ${STATUS_PILL[l.status]}`} />
            {l.label}
          </span>
        ))}
        <span>· A student is only marked red or absent 5 minutes after the bus reaches the stop, or once it leaves.</span>
      </div>
    </main>
  );
}

function SubTag() {
  return (
    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 uppercase">
      Substitute today
    </span>
  );
}
