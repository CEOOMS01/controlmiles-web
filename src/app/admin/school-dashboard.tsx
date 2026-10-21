// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/school-dashboard.tsx
//
// Driving school dashboard (2026-10-20, user request: "a more professional
// dashboard for this mode"). Built after Samsara / Motive (KPI row with a
// trend, an action list of what needs attention, live map) and driving
// school tools (DriveSchoolPro, ZoomScheduler: lessons today, instructor
// utilization, student pipeline, balances). Every block shows only when the
// school's plan includes it (fn_org_features); RLS enforces the same.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BranchScope } from "@/lib/branch-scope";
import type { FeatureSet, FleetFeature } from "@/lib/fleet-features";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import {
  NO_PROGRAM,
  PROGRAM_COLUMNS,
  money,
  requirementMet,
  studentName,
  type Program,
  type StudentProgress,
} from "@/lib/driving-school";
import { InstructorLoadChart, LessonsPerWeekChart, type InstructorLoad, type WeekPoint } from "./school-charts";

type Block = {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  student_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  late_cancel: boolean | null;
  booked_via: string | null;
};
type Name = { first_name: string | null; last_name: string | null };
type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  branch_id: string | null;
  program_id: string | null;
};

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const lengthOf = (b: Block) => minutesOf(b.end_time) - minutesOf(b.start_time);
const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const hours = (min: number) => Math.round((min / 60) * 10) / 10;

// The school's own wall clock (organizations.timezone), like shifts/page.tsx.
function localNow(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, minutes: Number(parts.hour) * 60 + Number(parts.minute), dow: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

export async function SchoolDashboard({
  orgId,
  orgName,
  timeZone,
  features,
  scope,
  map,
}: {
  orgId: string;
  orgName: string | null;
  timeZone: string;
  features: FeatureSet;
  scope: BranchScope;
  map: React.ReactNode;
}) {
  const supabase = await createClient();
  const has = (f: FleetFeature) => features.has(f);
  const classes = has("classes");
  const students = has("students");
  const packages = has("student_packages");
  const certificates = has("student_certificates");
  const availability = has("student_booking");

  const now = localNow(timeZone);
  const today = now.date;
  const weekStart = addDays(today, -((now.dow + 6) % 7)); // Monday
  const firstWeek = addDays(weekStart, -56);
  const from = firstWeek < addDays(today, -60) ? firstWeek : addDays(today, -60);
  const none = Promise.resolve({ data: null });

  const [
    { data: blockRows },
    { data: memberRows },
    { data: vehicleRows },
    { data: studentRows },
    { data: progressRows },
    { data: programRows },
    { data: packageRows },
    { data: certificateRows },
    { data: availabilityRows },
    { count: failedInspections },
    fleetIds,
  ] = await Promise.all([
    classes
      ? supabase
          .from("shift_blocks")
          .select("id, driver_id, vehicle_id, student_id, block_date, start_time, end_time, status, late_cancel, booked_via")
          .eq("organization_id", orgId)
          .gte("block_date", from)
          .lte("block_date", addDays(weekStart, 6))
      : none,
    supabase
      .from("organization_members")
      .select("user_id, member_role, profiles(first_name, last_name)")
      .eq("organization_id", orgId)
      .eq("is_active", true),
    supabase.from("vehicles").select("id, nickname, display_id, active_session_id").eq("organization_id", orgId).eq("is_archived", false),
    students
      ? supabase.from("ds_students").select("id, first_name, last_name, status, branch_id, program_id").eq("organization_id", orgId)
      : none,
    students ? supabase.rpc("ds_student_progress", { p_org: orgId }) : none,
    students ? supabase.from("ds_programs").select(PROGRAM_COLUMNS).eq("organization_id", orgId) : none,
    packages
      ? supabase.from("ds_student_packages").select("student_id, price_cents, amount_paid_cents").eq("organization_id", orgId)
      : none,
    certificates ? supabase.from("ds_certificates").select("student_id").eq("organization_id", orgId) : none,
    availability
      ? supabase.from("ds_availability").select("instructor_id, start_time, end_time").eq("organization_id", orgId)
      : none,
    has("dvir")
      ? supabase
          .from("vehicle_inspections")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("overall_status", "fail")
      : Promise.resolve({ count: 0 }),
    fleetDriverIds(supabase, orgId),
  ]);

  // Branch filter (sidebar): a student by their branch, a lesson by its
  // student's branch (or its instructor's when it has no student).
  const allStudents = (studentRows ?? []) as StudentRow[];
  const studentById = new Map(allStudents.map((s) => [s.id, s]));
  const inBranch = (s: StudentRow | undefined) => !scope.current || s?.branch_id === scope.current.id;
  const myStudents = allStudents.filter((s) => inBranch(s));
  const blocks = ((blockRows ?? []) as Block[]).filter((b) =>
    b.student_id ? inBranch(studentById.get(b.student_id)) : scope.driverIn(b.driver_id),
  );

  const names = new Map(
    (memberRows ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Name | null;
      return [m.user_id as string, driverLabel(p, null, fleetIds.get(m.user_id) ?? "Instructor")];
    }),
  );
  const teamCount = (memberRows ?? []).filter((m) => scope.driverIn(m.user_id)).length;
  const vehicleName = new Map(
    (vehicleRows ?? []).map((v) => [v.id as string, (v.nickname || v.display_id || "Vehicle") as string]),
  );
  const myVehicles = (vehicleRows ?? []).filter((v) => scope.vehicleIn(v.id));
  const vehicleCount = myVehicles.length;
  const onTheRoad = myVehicles.filter((v) => v.active_session_id != null).length;

  // ---- KPIs -------------------------------------------------------------
  const todays = blocks
    .filter((b) => b.block_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const live = todays.filter((b) => b.status !== "cancelled");
  const doneToday = live.filter((b) => b.status === "done").length;
  const inProgress = live.filter((b) => b.status === "in_progress").length;

  const d30 = addDays(today, -30);
  const d60 = addDays(today, -60);
  const taught = (a: string, z: string) =>
    blocks.filter((b) => b.status === "done" && b.block_date > a && b.block_date <= z).reduce((s, b) => s + lengthOf(b), 0);
  const taught30 = taught(d30, today);
  const taughtPrev = taught(d60, d30);
  const trend = taughtPrev > 0 ? Math.round(((taught30 - taughtPrev) / taughtPrev) * 100) : null;
  const cancelled30 = blocks.filter((b) => b.status === "cancelled" && b.block_date > d30 && b.block_date <= today);
  const lateCancels = cancelled30.filter((b) => b.late_cancel).length;

  const activeStudents = myStudents.filter((s) => s.status === "active").length;
  const registered = myStudents.filter((s) => s.status === "registered").length;

  const myIds = new Set(myStudents.map((s) => s.id));
  const owedBy = new Map<string, number>();
  for (const p of packageRows ?? []) {
    if (!myIds.has(p.student_id)) continue;
    const owed = Number(p.price_cents ?? 0) - Number(p.amount_paid_cents ?? 0);
    if (owed > 0) owedBy.set(p.student_id, (owedBy.get(p.student_id) ?? 0) + owed);
  }
  const owedTotal = [...owedBy.values()].reduce((s, v) => s + v, 0);

  // ---- Needs attention --------------------------------------------------
  const programs = (programRows ?? []) as Program[];
  const progress = ((progressRows ?? []) as StudentProgress[]).filter((p) => myIds.has(p.student_id));
  const certified = new Set((certificateRows ?? []).map((c) => c.student_id as string));
  const current = (id: string) => ["active", "registered"].includes(studentById.get(id)?.status ?? "");
  const programOf = (id: string) => programs.find((p) => p.id === studentById.get(id)?.program_id) ?? NO_PROGRAM;

  const readyForCert = certificates
    ? progress.filter(
        (p) =>
          !certified.has(p.student_id) &&
          programOf(p.student_id).required_minutes > 0 &&
          requirementMet(p, programOf(p.student_id)) &&
          studentById.get(p.student_id)?.status !== "dropped",
      )
    : [];
  const lowHours = packages
    ? progress.filter(
        (p) => current(p.student_id) && Number(p.purchased_minutes) > 0 && Number(p.purchased_minutes) - Number(p.minutes) <= 60,
      )
    : [];
  const noNextClass = classes
    ? progress.filter((p) => studentById.get(p.student_id)?.status === "active" && !p.next_class)
    : [];
  const noVehicle = live.filter((b) => !b.vehicle_id && b.status === "scheduled");

  const one = (list: { student_id: string }[]) =>
    list.length === 1 ? `/admin/students/${list[0].student_id}` : "/admin/students";
  const who = (list: { student_id: string }[]) =>
    list
      .slice(0, 3)
      .map((p) => {
        const s = studentById.get(p.student_id);
        return s ? studentName(s) : "";
      })
      .filter(Boolean)
      .join(", ") + (list.length > 3 ? ` and ${list.length - 3} more` : "");

  const attention: { tone: "danger" | "warning" | "info"; title: string; detail: string; href: string }[] = [];
  if ((failedInspections ?? 0) > 0)
    attention.push({
      tone: "danger",
      title: `${failedInspections} failed vehicle ${failedInspections === 1 ? "inspection" : "inspections"}`,
      detail: "Check the car before its next lesson.",
      href: "/admin/reviews",
    });
  if (noVehicle.length > 0)
    attention.push({
      tone: "danger",
      title: `${noVehicle.length} ${noVehicle.length === 1 ? "lesson" : "lessons"} today without a car`,
      detail: noVehicle.map((b) => `${time12(b.start_time)} · ${names.get(b.driver_id) ?? "Instructor"}`).join(", "),
      href: "/admin/shifts",
    });
  if (readyForCert.length > 0)
    attention.push({
      tone: "info",
      title: `${readyForCert.length} ${readyForCert.length === 1 ? "student" : "students"} ready for a certificate`,
      detail: who(readyForCert),
      href: one(readyForCert),
    });
  if (owedBy.size > 0)
    attention.push({
      tone: "warning",
      title: `${money(owedTotal)} owed by ${owedBy.size} ${owedBy.size === 1 ? "student" : "students"}`,
      detail: who([...owedBy.keys()].map((student_id) => ({ student_id }))),
      href: one([...owedBy.keys()].map((student_id) => ({ student_id }))),
    });
  if (lowHours.length > 0)
    attention.push({
      tone: "warning",
      title: `${lowHours.length} ${lowHours.length === 1 ? "student has" : "students have"} 1 hour or less left`,
      detail: who(lowHours),
      href: one(lowHours),
    });
  if (noNextClass.length > 0)
    attention.push({
      tone: "info",
      title: `${noNextClass.length} active ${noNextClass.length === 1 ? "student" : "students"} with no lesson booked`,
      detail: who(noNextClass),
      href: one(noNextClass),
    });

  // ---- Charts -----------------------------------------------------------
  const weeks: WeekPoint[] = Array.from({ length: 9 }, (_, i) => {
    const a = addDays(firstWeek, i * 7);
    const z = addDays(a, 6);
    const inWeek = blocks.filter((b) => b.block_date >= a && b.block_date <= z);
    return {
      week: shortDate(a),
      done: inWeek.filter((b) => b.status === "done").length,
      upcoming: inWeek.filter((b) => b.status === "scheduled" || b.status === "in_progress").length,
      cancelled: inWeek.filter((b) => b.status === "cancelled").length,
    };
  });

  const bookedBy = new Map<string, number>();
  for (const b of blocks) {
    if (b.block_date < weekStart || b.status === "cancelled") continue;
    bookedBy.set(b.driver_id, (bookedBy.get(b.driver_id) ?? 0) + lengthOf(b));
  }
  const availBy = new Map<string, number>();
  for (const a of availabilityRows ?? []) {
    if (!scope.driverIn(a.instructor_id)) continue;
    availBy.set(a.instructor_id, (availBy.get(a.instructor_id) ?? 0) + minutesOf(a.end_time) - minutesOf(a.start_time));
  }
  const load: InstructorLoad[] = [...new Set([...bookedBy.keys(), ...availBy.keys()])]
    .map((id) => {
      const booked = bookedBy.get(id) ?? 0;
      const avail = availBy.get(id);
      return {
        name: (names.get(id) ?? "Instructor").split(" / ")[0],
        booked: hours(booked),
        open: availability ? hours(Math.max(0, (avail ?? 0) - booked)) : null,
      };
    })
    .sort((a, b) => b.booked - a.booked);
  const totalAvail = [...availBy.values()].reduce((s, v) => s + v, 0);
  const totalBooked = [...bookedBy.entries()].filter(([id]) => availBy.has(id)).reduce((s, [, v]) => s + v, 0);
  const utilization = availability && totalAvail > 0 ? Math.round((totalBooked / totalAvail) * 100) : null;

  const pipeline = [
    { key: "registered", label: "Registered", cls: "bg-accent/30" },
    { key: "active", label: "Active", cls: "bg-accent" },
    { key: "finished", label: "Finished", cls: "bg-success" },
    { key: "dropped", label: "Dropped", cls: "bg-muted/40" },
  ].map((p) => ({ ...p, count: myStudents.filter((s) => s.status === p.key).length }));
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0);

  const longToday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted">{orgName}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            School dashboard{scope.current && <span className="text-muted"> · {scope.current.name}</span>}
          </h1>
          <p className="mt-1 text-sm text-muted">{longToday}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {students && (
            <Link href="/admin/students" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent">
              Students
            </Link>
          )}
          {classes && (
            <Link
              href="/admin/shifts"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Schedule a lesson
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {classes ? (
          <Kpi
            label="Lessons today"
            value={String(live.length)}
            sub={
              live.length === 0
                ? "Nothing on the schedule"
                : [`${doneToday} done`, inProgress ? `${inProgress} in progress` : null, `${live.length - doneToday - inProgress} to go`]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        ) : (
          <Kpi label="Team" value={String(teamCount)} sub="Instructors and office" />
        )}
        {classes ? (
          <Kpi
            label="Hours taught · 30 days"
            value={`${hours(taught30)} h`}
            sub={trend == null ? "No earlier month to compare" : `${trend >= 0 ? "+" : ""}${trend}% vs previous 30 days`}
            tone={trend == null ? undefined : trend >= 0 ? "up" : "down"}
          />
        ) : (
          <Kpi label="Vehicles" value={String(vehicleCount)} sub="In the fleet" />
        )}
        {students ? (
          <Kpi label="Active students" value={String(activeStudents)} sub={`${registered} registered, not started`} />
        ) : (
          <Kpi
            label="Failed inspections"
            value={String(failedInspections ?? 0)}
            sub="To review"
            tone={(failedInspections ?? 0) > 0 ? "down" : undefined}
          />
        )}
        {packages ? (
          <Kpi
            label="Balance owed"
            value={money(owedTotal)}
            sub={owedBy.size ? `${owedBy.size} ${owedBy.size === 1 ? "student" : "students"}` : "Everyone is paid up"}
            tone={owedTotal > 0 ? "down" : undefined}
          />
        ) : classes ? (
          <Kpi
            label="Cancellations · 30 days"
            value={String(cancelled30.length)}
            sub={`${lateCancels} late`}
            tone={lateCancels > 0 ? "down" : undefined}
          />
        ) : (
          <Kpi label="Cars on the road" value={String(onTheRoad)} sub={`of ${vehicleCount} right now`} />
        )}
      </div>

      {(classes || attention.length > 0 || has("dvir")) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {classes && (
            <section className="rounded-xl border border-border bg-surface p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Today&apos;s lessons</p>
                <Link href="/admin/shifts" className="text-sm text-accent hover:underline">
                  Full schedule
                </Link>
              </div>
              {todays.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No lessons today.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {todays.map((b) => {
                    const s = b.student_id ? studentById.get(b.student_id) : undefined;
                    return (
                      <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                        <span className="w-36 shrink-0 font-medium tabular-nums">
                          {time12(b.start_time)}–{time12(b.end_time)}
                        </span>
                        <span className="min-w-0 flex-1">
                          {s ? (
                            <Link href={`/admin/students/${s.id}`} className="font-medium hover:text-accent">
                              {studentName(s)}
                            </Link>
                          ) : (
                            <span className="text-muted">Open lesson</span>
                          )}
                          <span className="block text-xs text-muted">
                            {[names.get(b.driver_id) ?? "Instructor", b.vehicle_id ? vehicleName.get(b.vehicle_id) : "No car"]
                              .filter(Boolean)
                              .join(" · ")}
                            {b.booked_via === "portal" && " · Booked online"}
                          </span>
                        </span>
                        <StatusPill block={b} nowMinutes={now.minutes} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}
          <section className={`rounded-xl border border-border bg-surface p-5 ${classes ? "" : "lg:col-span-3"}`}>
            <p className="mb-3 font-semibold">Needs attention</p>
            {attention.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-success">All clear</p>
                <p className="mt-1 text-xs text-muted">Nothing waiting on you right now.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {attention.map((a) => (
                  <li key={a.title}>
                    <Link
                      href={a.href}
                      className="flex gap-3 rounded-lg border border-border p-3 text-sm transition hover:border-accent"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : "bg-accent"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{a.title}</span>
                        <span className="block truncate text-xs text-muted">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {classes && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <LessonsPerWeekChart data={weeks} />
          <div className="space-y-4">
            {utilization != null && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4">
                <div>
                  <p className="font-semibold">Instructor utilization</p>
                  <p className="text-sm text-muted">Booked hours of the available hours this week.</p>
                </div>
                <p className="text-3xl font-semibold tabular-nums">{utilization}%</p>
              </div>
            )}
            <InstructorLoadChart data={load} />
          </div>
        </div>
      )}

      {students && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Students</p>
            <p className="text-sm text-muted">{pipelineTotal} in total</p>
          </div>
          {pipelineTotal === 0 ? (
            <p className="text-sm text-muted">No students yet.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-border/50" role="img" aria-label="Students by status">
                {pipeline
                  .filter((p) => p.count > 0)
                  .map((p) => (
                    <div key={p.key} className={p.cls} style={{ width: `${(p.count / pipelineTotal) * 100}%` }} />
                  ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pipeline.map((p) => (
                  <Link key={p.key} href={`/admin/students?status=${p.key}`} className="rounded-lg p-2 hover:bg-border/30">
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${p.cls}`} />
                      {p.label}
                    </span>
                    <span className="mt-0.5 block text-xl font-semibold tabular-nums">{p.count}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {map && <div className="mt-6">{map}</div>}
    </main>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-muted"}`}>{sub}</p>
    </div>
  );
}

function StatusPill({ block, nowMinutes }: { block: Block; nowMinutes: number }) {
  const late = block.status === "scheduled" && nowMinutes > minutesOf(block.end_time);
  const [text, cls] =
    block.status === "done"
      ? ["Done", "bg-success/15 text-success"]
      : block.status === "in_progress"
        ? ["In progress", "bg-accent/15 text-accent"]
        : block.status === "cancelled"
          ? [block.late_cancel ? "Late cancel" : "Cancelled", "bg-border/60 text-muted"]
          : late
            ? ["Not started", "bg-danger/15 text-danger"]
            : ["Scheduled", "bg-border/60 text-foreground"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}
