// School transportation attendance (2026-10-09, user rule + 4 adjustments):
// the day's colors become the report. For every run of a school route in the
// date range, each student assigned to board that route is:
//   Present    (blue)   picked up
//   Released   (gray)   red alert resolved with a reason (parent pick-up,
//                       early dismissal, activity, other) -- counts as
//                       attendance; the reason and note go in the report
//   Absent     (yellow) not picked up in the AM / didn't ride this morning
//   Unresolved (red)    alert still open (only while a route is running)
//   Pending             the bus hasn't reached the stop yet
// Days a route didn't run aren't counted. The same rows feed the attendance
// page and the CSV the contractor sends to the county school district.

import type { SupabaseClient } from "@supabase/supabase-js";
import { RELEASE_REASON_LABEL, dueStopIds, loadRodeAm, runStatuses, type RiderStatus } from "./school-status";

export type AttendanceStatus = "Present" | "Released" | "Absent" | "Unresolved" | "Pending";

export const ATTENDANCE_COLOR: Record<AttendanceStatus, RiderStatus> = {
  Present: "blue",
  Released: "gray",
  Absent: "yellow",
  Unresolved: "red",
  Pending: "pending",
};

export type AttendanceRow = {
  date: string;
  student: string;
  studentExternalId: string | null;
  grade: string | null;
  school: string | null;
  route: string;
  run: "AM" | "PM";
  status: AttendanceStatus;
  pickedUpAt: string | null; // ISO; for Released, when it was recorded
  stop: string | null;
  note: string | null; // release reason + note
};

const toAttendance = (s: RiderStatus): AttendanceStatus =>
  s === "blue" ? "Present" : s === "gray" ? "Released" : s === "yellow" ? "Absent" : s === "red" ? "Unresolved" : "Pending";

export async function loadAttendance(
  supabase: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
  routeId?: string | null,
): Promise<AttendanceRow[]> {
  let runsQuery = supabase
    .from("route_runs")
    .select("id, route_id, run_date, status, routes(name, route_type)")
    .eq("organization_id", orgId)
    .gte("run_date", from)
    .lte("run_date", to)
    .order("run_date");
  if (routeId) runsQuery = runsQuery.eq("route_id", routeId);
  const { data: runs } = await runsQuery;
  if (!runs?.length) return [];

  const routeIds = [...new Set(runs.map((r) => r.route_id))];
  const runIds = runs.map((r) => r.id);
  const [{ data: assignments }, { data: events }, { data: reached }, { data: students }, { data: schools }, { data: stops }, rodeAm] =
    await Promise.all([
      supabase.from("student_stop_assignments").select("route_id, student_id, stop_id, action").in("route_id", routeIds),
      supabase.from("ridership_events").select("run_id, student_id, stop_id, action, at, reason, note").in("run_id", runIds),
      supabase.from("route_stop_events").select("run_id, stop_id, arrived_at, departed_at").in("run_id", runIds),
      supabase.from("students").select("id, first_name, last_initial, grade, external_id, school_site_id").eq("organization_id", orgId),
      supabase.from("school_sites").select("id, name").eq("organization_id", orgId),
      supabase.from("route_stops").select("id, name").in("route_id", routeIds),
      loadRodeAm(supabase, orgId, from, to),
    ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const stopName = new Map((stops ?? []).map((s) => [s.id, s.name]));

  const rows: AttendanceRow[] = [];
  for (const run of runs) {
    const route = Array.isArray(run.routes) ? run.routes[0] : run.routes;
    const routeAssignments = (assignments ?? []).filter((x) => x.route_id === run.route_id);
    const rides = (events ?? []).filter((e) => e.run_id === run.id);
    const statuses = runStatuses({
      routeType: route?.route_type ?? "school_am",
      completed: run.status === "completed",
      dueStops: dueStopIds((reached ?? []).filter((e) => e.run_id === run.id)),
      assignments: routeAssignments,
      rides,
      rodeAm: (studentId) => rodeAm.has(`${run.run_date}:${studentId}`),
    });
    for (const a of routeAssignments.filter((x) => x.action === "board")) {
      const st = studentById.get(a.student_id);
      if (!st) continue;
      const s = statuses.get(`${a.student_id}:board`);
      const status = toAttendance(s?.status ?? "pending");
      const boardEv = rides.find((e) => e.student_id === a.student_id && e.action === "board");
      const releasedEv = rides.find((e) => e.student_id === a.student_id && e.action === "released");
      rows.push({
        date: run.run_date,
        student: `${st.first_name}${st.last_initial ? ` ${st.last_initial}.` : ""}`,
        studentExternalId: st.external_id,
        grade: st.grade,
        school: st.school_site_id ? (schoolName.get(st.school_site_id) ?? null) : null,
        route: route?.name ?? "",
        run: route?.route_type === "school_pm" ? "PM" : "AM",
        status,
        pickedUpAt: boardEv?.at ?? (status === "Released" ? (releasedEv?.at ?? null) : null),
        stop: stopName.get(boardEv?.stop_id ?? a.stop_id) ?? null,
        note:
          status === "Released"
            ? [RELEASE_REASON_LABEL[s?.reason ?? "other"] ?? s?.reason, s?.note].filter(Boolean).join(" -- ")
            : status === "Absent" && route?.route_type === "school_pm"
              ? "Didn't ride this morning"
              : status === "Unresolved"
                ? "Rode this morning, hasn't come out -- driver/monitor checking at the school"
                : null,
      });
    }
  }
  rows.sort((x, y) => x.date.localeCompare(y.date) || x.route.localeCompare(y.route) || x.student.localeCompare(y.student));
  return rows;
}

/** Present + Released count as attendance; Pending isn't decided yet. */
export function attendanceTotals(rows: AttendanceRow[]) {
  const n = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
  const present = n("Present");
  const released = n("Released");
  const absent = n("Absent");
  const unresolved = n("Unresolved");
  const decided = present + released + absent;
  return {
    present,
    released,
    absent,
    unresolved,
    rate: decided ? Math.round(((present + released) / decided) * 100) : null,
  };
}

export function attendanceCsv(rows: AttendanceRow[], timezone: string): string {
  const esc = (v: string | null) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "";
  const header = ["Date", "Student", "District student ID", "Grade", "School", "Route", "Run", "Status", "Time", "Stop", "Note"];
  const lines = rows.map((r) =>
    [r.date, r.student, r.studentExternalId, r.grade, r.school, r.route, r.run, r.status, time(r.pickedUpAt), r.stop, r.note]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
