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
import { InstructorNoticeCard } from "./instructor-notice-card";
import { NeedsAttentionPanel } from "./needs-attention-panel";
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
  viewerName,
  viewerRole,
  timeZone,
  features,
  scope,
  map,
}: {
  orgId: string;
  orgName: string | null;
  viewerName: string;
  viewerRole: string | null;
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

  const { data: noticeRows } = classes
    ? await supabase
        .from("instructor_notices")
        .select("id, body, is_active, ends_on")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
    : { data: null };

  const now = localNow(timeZone);
  const today = now.date;
  const weekStart = addDays(today, -((now.dow + 6) % 7)); // Monday
  const firstWeek = addDays(weekStart, -56);
  const from = firstWeek < addDays(today, -60) ? firstWeek : addDays(today, -60);
  const none = Promise.resolve({ data: null });

  const [
    { data: blockRows },
    { data: memberRows },
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

  // ---- KPIs -------------------------------------------------------------
  const todays = blocks
    .filter((b) => b.block_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const live = todays.filter((b) => b.status !== "cancelled");



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


  const longToday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  // Greeting by the school's own clock.
  const greeting = now.minutes < 12 * 60 ? "Good morning" : now.minutes < 18 * 60 ? "Good afternoon" : "Good evening";
  // Role badge: owner blue, admin green, operator yellow.
  const roleBadge =
    {
      owner: { label: "Owner", cls: "bg-accent/15 text-accent" },
      admin: { label: "Admin", cls: "bg-success/15 text-success" },
      operator: { label: "Operator", cls: "bg-[#fde047] text-[#713f12]" },
    }[viewerRole ?? ""] ?? null;

  return (
    <>
    {/* Header edge to edge of the content area, with its line across the whole width (2026-11-20). */}
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border px-5 pb-3 pt-7 sm:px-8">
      {/* The name sits right on the line. */}
      <h1 className="text-2xl font-semibold leading-none tracking-tight">
        {orgName || "School dashboard"}
        {scope.current && <span className="text-lg font-medium text-muted"> · {scope.current.name}</span>}
      </h1>
      <div className="text-right">
        <p className="text-xs text-muted">{longToday}</p>
        <p className="mt-0.5 text-sm font-medium">
          {greeting}
          {viewerName ? `, ${viewerName}` : ""}
          {roleBadge && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge.cls}`}>{roleBadge.label}</span>}
        </p>
      </div>
    </header>
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-8">

      {(attention.length > 0 || has("dvir") || classes) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {classes ? (
            // Schools with classes: the live notification panel, with the page's own items above them.
            <NeedsAttentionPanel orgId={orgId} items={attention} />
          ) : (
            <section className="rounded-xl border border-border bg-surface p-5 lg:col-span-3">
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
          )}
        </div>
      )}

      {classes && (
        <div className="mt-6">
          <InstructorNoticeCard orgId={orgId} notices={noticeRows ?? []} />
        </div>
      )}

      {classes && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <LessonsPerWeekChart data={weeks} />
          <div className="space-y-4">
            <InstructorLoadChart data={load} />
          </div>
        </div>
      )}

      {map && <div className="mt-6">{map}</div>}
    </main>
    </>
  );
}
