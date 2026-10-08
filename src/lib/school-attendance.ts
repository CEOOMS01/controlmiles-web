// School transportation attendance (2026-10-09, user rule): a pick-up is the
// day's attendance. For every run of a school route in the date range, each
// student assigned to board that route is Present if the driver/monitor
// marked them on, Absent otherwise. Days a route didn't run aren't counted.
// The same rows feed the attendance page and the CSV the contractor sends to
// the county school district.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AttendanceRow = {
  date: string;
  student: string;
  studentExternalId: string | null;
  grade: string | null;
  school: string | null;
  route: string;
  run: "AM" | "PM";
  status: "Present" | "Absent";
  pickedUpAt: string | null; // ISO
  stop: string | null;
};

export async function loadAttendance(
  supabase: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
  routeId?: string | null,
): Promise<AttendanceRow[]> {
  let runsQuery = supabase
    .from("route_runs")
    .select("id, route_id, run_date, routes(name, route_type)")
    .eq("organization_id", orgId)
    .gte("run_date", from)
    .lte("run_date", to)
    .order("run_date");
  if (routeId) runsQuery = runsQuery.eq("route_id", routeId);
  const { data: runs } = await runsQuery;
  if (!runs?.length) return [];

  const routeIds = [...new Set(runs.map((r) => r.route_id))];
  const runIds = runs.map((r) => r.id);
  const [{ data: assignments }, { data: events }, { data: students }, { data: schools }, { data: stops }] =
    await Promise.all([
      supabase
        .from("student_stop_assignments")
        .select("route_id, student_id, stop_id")
        .in("route_id", routeIds)
        .eq("action", "board"),
      supabase.from("ridership_events").select("run_id, student_id, stop_id, at").in("run_id", runIds).eq("action", "board"),
      supabase.from("students").select("id, first_name, last_initial, grade, external_id, school_site_id").eq("organization_id", orgId),
      supabase.from("school_sites").select("id, name").eq("organization_id", orgId),
      supabase.from("route_stops").select("id, name").in("route_id", routeIds),
    ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const stopName = new Map((stops ?? []).map((s) => [s.id, s.name]));
  const boarded = new Map((events ?? []).map((e) => [`${e.run_id}:${e.student_id}`, e]));

  const rows: AttendanceRow[] = [];
  for (const run of runs) {
    const route = Array.isArray(run.routes) ? run.routes[0] : run.routes;
    for (const a of (assignments ?? []).filter((x) => x.route_id === run.route_id)) {
      const st = studentById.get(a.student_id);
      if (!st) continue;
      const ev = boarded.get(`${run.id}:${a.student_id}`);
      rows.push({
        date: run.run_date,
        student: `${st.first_name}${st.last_initial ? ` ${st.last_initial}.` : ""}`,
        studentExternalId: st.external_id,
        grade: st.grade,
        school: st.school_site_id ? (schoolName.get(st.school_site_id) ?? null) : null,
        route: route?.name ?? "",
        run: route?.route_type === "school_pm" ? "PM" : "AM",
        status: ev ? "Present" : "Absent",
        pickedUpAt: ev?.at ?? null,
        stop: stopName.get(ev?.stop_id ?? a.stop_id) ?? null,
      });
    }
  }
  rows.sort((x, y) => x.date.localeCompare(y.date) || x.route.localeCompare(y.route) || x.student.localeCompare(y.student));
  return rows;
}

export function attendanceCsv(rows: AttendanceRow[], timezone: string): string {
  const esc = (v: string | null) => {
    const s = v ?? "";
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }) : "";
  const header = ["Date", "Student", "District student ID", "Grade", "School", "Route", "Run", "Status", "Picked up at", "Stop"];
  const lines = rows.map((r) =>
    [r.date, r.student, r.studentExternalId, r.grade, r.school, r.route, r.run, r.status, time(r.pickedUpAt), r.stop]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
