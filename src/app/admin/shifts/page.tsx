import { Page, PageHeader, PageTabs } from "@/components/page-ui";
import { Sheet } from "@/components/sheet";
import { createClient } from "@/lib/supabase/server";
import { getBranchScope } from "@/lib/branch-scope";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { ShiftForm } from "./shift-form";
import { ShiftRowActions } from "./shift-row-actions";
import { ClassBlockForm } from "./class-block-form";
import { ClassBlockActions } from "./class-block-actions";
import { SchoolAgenda } from "./school-agenda";
import { BlockedHoursForm, RemoveBlocked } from "./blocked-hours";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { requireFeature } from "@/lib/fleet-features";
import { WEEKDAYS } from "@/lib/driving-school";
import { AvailabilityForm, RemoveButton, TimeOffForm } from "../students/student-forms";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Explicit user request, 2026-09-22: color distinguishes WHEN an active
// shift runs (morning vs. evening/night), never a status alert (overtime,
// late start) -- those need real attendance data (sessions.start_time
// compared against the scheduled shift), which doesn't exist yet and is
// scoped for the Enterprise pass. Keeping this to a single dimension
// avoids the ambiguity of a night shift that's ALSO running late: with
// alerts on their own channel later, that stays representable as two
// facts instead of one color fighting itself.
function shiftPeriod(startTime: string): "morning" | "evening" {
  const hour = Number(startTime.split(":")[0]);
  return hour < 12 ? "morning" : "evening";
}

// Icon, not color -- explicit user follow-up: color is reserved
// exclusively for real attendance status (on-time/overtime/late, the
// Enterprise pass below), so it always means "pay attention" and never
// doubles as a category. Morning/evening is just a fact about the
// schedule, not something that needs to compete for that channel.
const PERIOD_ICON = { morning: "☀️", evening: "🌙" } as const;

// Enterprise (explicit user request, 2026-09-22): compares a shift
// scheduled for TODAY against the driver's real sessions for today
// (sessions.start_time -- the actual GPS-validated moment they started
// driving, not something self-reported). Grace period mirrors the
// 15-minute "active" window fleet-map.tsx already uses elsewhere in
// this app for "is this vehicle currently active" -- same tolerance,
// same reasoning (GPS/clock jitter, not a hard deadline).
const LATE_GRACE_MINUTES = 15;

type AttendanceStatus = "on_time" | "late" | "overtime" | "upcoming" | null;

function attendanceStatus(
  shift: { start_time: string; end_time: string },
  todaysSessions: { start_time: string | null; end_time: string | null }[],
  now: Date,
): AttendanceStatus {
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const shiftStart = toMinutes(shift.start_time);
  const shiftEnd = toMinutes(shift.end_time);

  // REAL BUG FOUND AND FIXED WHILE VERIFYING LIVE: a driver with more
  // than one shift today (e.g. a morning shift and a separate evening
  // shift) has all of today's sessions passed in here, not just the one
  // that belongs to THIS shift -- without this filter, an early-morning
  // trip was being matched against a still-"upcoming" evening shift too,
  // reading as "on time" for a shift that hadn't started yet. Only a
  // session whose own start falls inside this shift's own window
  // (with the same grace period) can belong to it.
  const belongsToThisShift = (s: { start_time: string | null }) => {
    if (!s.start_time) return false;
    const d = new Date(s.start_time);
    const startMinutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    return startMinutes >= shiftStart - LATE_GRACE_MINUTES && startMinutes <= shiftEnd;
  };
  const session = todaysSessions.find(belongsToThisShift);

  if (!session) {
    if (nowMinutes < shiftStart) return "upcoming";
    if (nowMinutes > shiftStart + LATE_GRACE_MINUTES) return "late";
    return "upcoming";
  }

  const sessionStartMinutes = session.start_time
    ? (() => {
        const d = new Date(session.start_time!);
        return d.getUTCHours() * 60 + d.getUTCMinutes();
      })()
    : null;

  const stillRunning = !session.end_time;
  if (stillRunning && nowMinutes > shiftEnd) return "overtime";
  if (session.end_time) {
    const ended = new Date(session.end_time);
    const endedMinutes = ended.getUTCHours() * 60 + ended.getUTCMinutes();
    if (endedMinutes > shiftEnd) return "overtime";
  }

  if (sessionStartMinutes != null && sessionStartMinutes > shiftStart + LATE_GRACE_MINUTES) return "late";

  return "on_time";
}

const ATTENDANCE_BADGE: Record<Exclude<AttendanceStatus, null>, { label: string; className: string }> = {
  on_time: { label: "On time", className: "bg-success/15 text-success" },
  overtime: { label: "Overtime", className: "bg-[#a16207]/15 text-[#a16207]" },
  late: { label: "Late start", className: "bg-danger/15 text-danger" },
  upcoming: { label: "Upcoming", className: "bg-border text-muted" },
};

function formatTimeOfDay(t: string, timeFormat: "12h" | "24h") {
  const [h, m] = t.split(":");
  const hour = Number(h);
  if (timeFormat === "24h") return `${String(hour).padStart(2, "0")}:${m}`;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${period}`;
}

// The fleet's own wall clock (organizations.timezone). Shift times are
// local times, so "today", "now" and the weekday must come from the
// fleet's timezone, not the server's UTC.
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
      weekday: "short",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dow: new Date(`${date}T00:00:00Z`).getUTCDay(),
  };
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type ClassBlock = {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
  student_id: string | null;
  source: "template" | "one_off";
  status: "scheduled" | "in_progress" | "done" | "cancelled";
  late_minutes: number | null;
};

// Scheduled blocks get a live label from the start window (the same rule
// start_shift_block enforces); the rest show their recorded status.
function classBlockBadge(
  b: ClassBlock,
  today: { date: string; minutes: number },
  windowMin: number,
): { label: string; className: string } {
  const late = b.late_minutes && b.late_minutes > 0 ? ` · ${b.late_minutes} min late` : "";
  if (b.status === "in_progress") return { label: `In class${late}`, className: "bg-accent/15 text-accent" };
  if (b.status === "done") return { label: `Done${late}`, className: "bg-success/15 text-success" };
  if (b.status === "cancelled") return { label: "Cancelled", className: "bg-border text-muted" };
  const start = toMinutes(b.start_time);
  const past = b.block_date < today.date || (b.block_date === today.date && today.minutes > start + windowMin);
  if (past) return { label: "Missed", className: "bg-danger/15 text-danger" };
  if (b.block_date === today.date && today.minutes >= start - windowMin)
    return { label: "Open to start", className: "bg-warning/15 text-warning" };
  return { label: "Scheduled", className: "bg-border text-muted" };
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[]; tab?: string | string[] }>;
}) {
  const features = await requireFeature("shift_schedules", "classes");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  // Driving schools get classes; recurring weekly shifts (with live
  // attendance against the real trip start) come with Growth.
  const hasClasses = features.has("classes");
  const hasWeekly = features.has("shift_schedules");

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("timezone, shift_start_window_minutes")
    .eq("id", orgId)
    .maybeSingle();
  const timeZone = orgRow?.timezone ?? "America/New_York";
  const windowMin = orgRow?.shift_start_window_minutes ?? 10;
  const local = localNow(timeZone);

  const now = new Date();
  // Was getUTCDay()/toISOString(): in the evening (US) that is already
  // tomorrow in UTC, so "today's" attendance looked at the wrong day.
  const todayDow = local.dow;
  const todayDateKey = local.date;

  const requested = (await searchParams).date;
  const selectedDate = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : local.date;
  const { data: dayBlocks } = hasClasses
    ? await supabase.rpc("get_org_shift_day", { p_org: orgId, p_date: selectedDate })
    : { data: [] as ClassBlock[] };

  const [
    { data: shifts },
    { data: driverMembers },
    { data: todaysSessions },
    { data: vehicles },
    { data: myProfile },
    fleetIds,
  ] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        "id, driver_id, vehicle_id, day_of_week, start_time, end_time, is_active, notes, profiles!shifts_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .order("driver_id")
      .order("day_of_week"),
    supabase
      .from("organization_members")
      .select("user_id, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
      // Driving schools: owners and admins often teach too (bug found
      // 2026-10-20: their classes and hours showed "Instructor").
      .in("member_role", hasClasses ? ["driver", "operator", "admin", "owner"] : ["driver"])
      .eq("is_active", true),
    hasWeekly
      ? supabase
          .from("sessions")
          .select("user_id, start_time, end_time")
          .eq("organization_id", orgId)
          .eq("date_key", todayDateKey)
      : Promise.resolve({ data: [] as { user_id: string; start_time: string | null; end_time: string | null }[] }),
    supabase
      .from("vehicles")
      .select("id, nickname, make, model, display_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
    fleetDriverIds(supabase, orgId),
  ]);

  const timeFormat: "12h" | "24h" = myProfile?.time_format === "24h" ? "24h" : "12h";

  const drivers = (driverMembers ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { id: m.user_id, label: driverLabel(p, fleetIds.get(m.user_id), p?.email || m.user_id) };
  });

  const vehicleLabel = (
    v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null,
  ) => {
    if (!v) return null;
    const name = [v.make, v.model].filter(Boolean).join(" ");
    return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || null;
  };
  const vehicleOptions = (vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) ?? "Vehicle" }));
  // Driving school students (2026-10-19): picked on each class.
  const { data: studentRows } = features.has("students")
    ? await supabase
        .from("ds_students")
        .select("id, first_name, last_name, status, program_id")
        .eq("organization_id", orgId)
        .order("last_name")
    : { data: [] as { id: string; first_name: string; last_name: string; status: string; program_id: string | null }[] };
  const { data: programRows } = features.has("students")
    ? await supabase.from("ds_programs").select("id, class_minutes").eq("organization_id", orgId)
    : { data: [] as { id: string; class_minutes: number }[] };
  const classMinutes = new Map((programRows ?? []).map((p) => [p.id, p.class_minutes]));
  const studentNames = new Map((studentRows ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`]));
  const studentOptions = (studentRows ?? [])
    .filter((s) => s.status === "active" || s.status === "registered")
    .map((s) => ({
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      // The school sets each program's class length; the agenda starts from it.
      minutes: (s.program_id ? classMinutes.get(s.program_id) : null) ?? 60,
    }));

  // Online booking (driving school phase 2, 2026-10-19): when each
  // instructor teaches; the portal offers only these hours.
  const hasBooking = features.has("student_booking");
  const [{ data: availRows }, { data: offRows }, { data: blockedRows }] = hasBooking
    ? await Promise.all([
        supabase
          .from("ds_availability")
          .select("id, instructor_id, weekday, start_time, end_time, vehicle_id")
          .eq("organization_id", orgId)
          .order("weekday")
          .order("start_time"),
        supabase
          .from("ds_time_off")
          .select("id, instructor_id, date_from, date_to, note")
          .eq("organization_id", orgId)
          .gte("date_to", selectedDate)
          .order("date_from"),
        supabase
          .from("ds_blocked_hours")
          .select("id, instructor_id, weekday, on_date, start_time, end_time, label")
          .eq("organization_id", orgId)
          .order("start_time"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const driverName = new Map(drivers.map((d) => [d.id, d.label]));
  const vehicleName = new Map(vehicleOptions.map((v) => [v.id, v.label]));
  const t5 = (t: string) => t.slice(0, 5);

  // Grouped by driver -- one card per driver, days listed inside, instead
  // of a flat table where the same driver's name repeats on every row.
  const byDriver = new Map<string, { driverName: string; rows: NonNullable<typeof shifts>[number][] }>();
  // Branch filter (sidebar, 2026-09-30): this branch's drivers.
  const scope = await getBranchScope(orgId);
  for (const s of shifts ?? []) {
    if (!scope.driverIn(s.driver_id)) continue;
    const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const driverName = driverLabel(p, fleetIds.get(s.driver_id), "Driver");
    if (!byDriver.has(s.driver_id)) byDriver.set(s.driver_id, { driverName, rows: [] });
    byDriver.get(s.driver_id)!.rows.push(s);
  }

  // Redesign (2026-10-20): one header with the add actions, the sections
  // as tabs (day / weekly / availability) instead of one long page.
  const tabParam = (await searchParams).tab;
  const tabs = [
    ...(hasClasses ? [{ id: "agenda", label: "Agenda" }, { id: "day", label: "Day" }] : []),
    ...(hasWeekly ? [{ id: "weekly", label: hasClasses ? "Weekly template" : "Weekly schedule" }] : []),
    ...(hasClasses && hasBooking ? [{ id: "availability", label: "Availability" }] : []),
  ];
  const tab = tabs.some((t) => t.id === tabParam) ? String(tabParam) : (tabs[0]?.id ?? "weekly");
  const dayQuery = selectedDate !== local.date ? selectedDate : undefined;

  return (
    <Page>
      <PageHeader
        title={hasClasses ? "Classes" : "Shifts"}
        description={
          hasClasses
            ? "When each instructor teaches, day by day and week by week."
            : "A recurring weekly schedule per driver."
        }
        actions={
          <>
            {hasWeekly && (tab === "weekly" || !hasClasses) && (
              <Sheet
                label={hasClasses ? "Add weekly class" : "Add shift"}
                title={hasClasses ? "Add a weekly class" : "Add a shift"}
              >
                <ShiftForm
                  orgId={orgId}
                  drivers={drivers}
                  vehicles={vehicleOptions}
                  timeFormat={timeFormat}
                  isClass={hasClasses}
                  inSheet
                />
              </Sheet>
            )}
            {hasClasses && (tab === "day" || tab === "agenda") && (
              <Sheet
                label="Add class"
                title="Add a class"
                description={`For ${selectedDate}. You can change the date in the form.`}
              >
                <ClassBlockForm
                  orgId={orgId}
                  drivers={drivers}
                  vehicles={vehicleOptions}
                  students={studentOptions}
                  timeFormat={timeFormat}
                  defaultDate={selectedDate}
                  today={local.date}
                  inSheet
                />
              </Sheet>
            )}
          </>
        }
      />
      {tabs.length > 1 && <PageTabs base="/admin/shifts" current={tab} tabs={tabs} keep={{ date: dayQuery }} />}

      <>
        {hasClasses && tab === "agenda" && (
          <SchoolAgenda
            orgId={orgId}
            drivers={drivers}
            vehicles={vehicleOptions}
            students={studentOptions}
            timeFormat={timeFormat}
            today={local.date}
            initialDate={selectedDate}
          />
        )}
        {hasClasses && tab === "day" && (
          <>
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <a
                    href={`?tab=day&date=${shiftDate(selectedDate, -1)}`}
                    className="rounded-lg border border-border px-3 py-1.5 hover:border-accent"
                    aria-label="Previous day"
                  >
                    ←
                  </a>
                  <form method="get" className="flex items-center gap-2">
                    <input type="hidden" name="tab" value="day" />
                    <input
                      type="date"
                      name="date"
                      defaultValue={selectedDate}
                      className="rounded-lg border border-border bg-background px-3 py-1.5"
                    />
                    <button type="submit" className="rounded-lg border border-border px-3 py-1.5 hover:border-accent">
                      Go
                    </button>
                  </form>
                  <a
                    href={`?tab=day&date=${shiftDate(selectedDate, 1)}`}
                    className="rounded-lg border border-border px-3 py-1.5 hover:border-accent"
                    aria-label="Next day"
                  >
                    →
                  </a>
                  {selectedDate !== local.date && (
                    <a href="?" className="text-accent hover:underline">
                      Today
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Instructors can start a class {windowMin} min before to {windowMin} min after its start.
                </p>
              </div>

              {(() => {
                const blocks = (dayBlocks ?? []) as ClassBlock[];
                if (blocks.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                      No classes on this day.
                    </div>
                  );
                }
                const driverNames = new Map(drivers.map((d) => [d.id, d.label]));
                const vehicleNames = new Map(vehicleOptions.map((v) => [v.id, v.label]));
                const byClassDriver = new Map<string, ClassBlock[]>();
                for (const b of blocks) {
                  if (!scope.driverIn(b.driver_id)) continue;
                  if (!byClassDriver.has(b.driver_id)) byClassDriver.set(b.driver_id, []);
                  byClassDriver.get(b.driver_id)!.push(b);
                }
                return (
                  <div className="space-y-4">
                    {Array.from(byClassDriver.entries()).map(([driverId, rows]) => (
                      <div key={driverId} className="overflow-hidden rounded-xl border border-border bg-surface">
                        <div className="border-b border-border px-4 py-3">
                          <p className="font-medium">{driverNames.get(driverId) ?? "Driver"}</p>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {rows.map((b) => {
                              const badge = classBlockBadge(b, local, windowMin);
                              return (
                                <tr key={b.id} className="border-b border-border last:border-0">
                                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                    {formatTimeOfDay(b.start_time, timeFormat)}–
                                    {formatTimeOfDay(b.end_time, timeFormat)}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted">
                                    {b.vehicle_id ? (vehicleNames.get(b.vehicle_id) ?? "Vehicle") : "—"}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {b.student_id && studentNames.get(b.student_id) ? (
                                      <a
                                        href={`/admin/students/${b.student_id}`}
                                        className="font-medium hover:text-accent"
                                      >
                                        {studentNames.get(b.student_id)}
                                      </a>
                                    ) : null}
                                    {b.note && <span className="block text-xs text-muted">{b.note}</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-muted">
                                    {b.source === "template" ? "Weekly" : "One-off"}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                      {badge.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <ClassBlockActions
                                      blockId={b.id}
                                      status={b.status}
                                      isOneOff={b.source === "one_off"}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          </>
        )}
        {hasClasses && hasBooking && tab === "availability" && (
          <>
            <section className="mb-10 grid gap-8 xl:grid-cols-2">
              <div>
                <h2 className="mb-1 text-base font-semibold">Instructor availability</h2>
                <p className="mb-3 text-sm text-muted">
                  Students book online only inside these hours, and never over a class already scheduled.
                </p>
                <AvailabilityForm instructors={drivers} vehicles={vehicleOptions} />
                {(availRows ?? []).length > 0 && (
                  <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
                    {(availRows ?? []).map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <span>
                          <span className="font-medium">{driverName.get(a.instructor_id) ?? "Instructor"}</span> ·{" "}
                          {WEEKDAYS[a.weekday]} {t5(a.start_time)}–{t5(a.end_time)}
                          {a.vehicle_id && (
                            <span className="text-muted"> · {vehicleName.get(a.vehicle_id) ?? "Vehicle"}</span>
                          )}
                        </span>
                        <RemoveButton id={a.id} kind="availability" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h2 className="mb-1 text-base font-semibold">Time off</h2>
                <p className="mb-3 text-sm text-muted">Days an instructor can&apos;t be booked.</p>
                <TimeOffForm instructors={drivers} />
                {(offRows ?? []).length > 0 && (
                  <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
                    {(offRows ?? []).map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <span>
                          <span className="font-medium">{driverName.get(o.instructor_id) ?? "Instructor"}</span> ·{" "}
                          {o.date_from === o.date_to ? o.date_from : `${o.date_from} to ${o.date_to}`}
                          {o.note && <span className="text-muted"> · {o.note}</span>}
                        </span>
                        <RemoveButton id={o.id} kind="time_off" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            <section className="mb-10">
              <h2 className="mb-1 text-base font-semibold">Blocked hours</h2>
              <p className="mb-3 text-sm text-muted">
                Hours nobody can be booked, such as lunch. For the whole school or one instructor. They show shaded in the agenda
                and online as not available.
              </p>
              <div className="grid gap-4 xl:grid-cols-2">
                <BlockedHoursForm orgId={orgId} instructors={drivers} />
                {(blockedRows ?? []).length > 0 && (
                  <ul className="h-fit divide-y divide-border rounded-xl border border-border bg-surface text-sm">
                    {(blockedRows ?? []).map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <span>
                          <span className="font-medium">{h.label || "Blocked"}</span> · {t5(h.start_time)}–{t5(h.end_time)} ·{" "}
                          {h.on_date ? h.on_date : h.weekday === null ? "every day" : WEEKDAYS[h.weekday]}
                          <span className="text-muted">
                            {" "}
                            · {h.instructor_id ? (driverName.get(h.instructor_id) ?? "Instructor") : "whole school"}
                          </span>
                        </span>
                        <RemoveBlocked id={h.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}

        {hasWeekly && tab === "weekly" && (
          <>
            {byDriver.size === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
                {hasClasses ? "No weekly classes yet." : "No shifts scheduled yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(byDriver.entries()).map(([driverId, { driverName, rows }]) => (
                  <div key={driverId} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="border-b border-border px-4 py-3">
                      <p className="font-medium">{driverName}</p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {rows.map((s) => {
                          const v = Array.isArray(s.vehicles) ? s.vehicles[0] : s.vehicles;
                          return (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-2.5 font-medium">{DAY_LABELS[s.day_of_week]}</td>
                              <td className="px-4 py-2.5 text-muted">
                                <span aria-hidden="true">{PERIOD_ICON[shiftPeriod(s.start_time)]}</span>{" "}
                                {formatTimeOfDay(s.start_time, timeFormat)}–{formatTimeOfDay(s.end_time, timeFormat)}
                              </td>
                              <td className="px-4 py-2.5 text-muted">{vehicleLabel(v) ?? "—"}</td>
                              <td className="px-4 py-2.5 text-muted">{s.notes ?? ""}</td>
                              <td className="px-4 py-2.5">
                                {!s.is_active ? (
                                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">Paused</span>
                                ) : (
                                  s.day_of_week === todayDow &&
                                  (() => {
                                    const status = attendanceStatus(
                                      s,
                                      (todaysSessions ?? []).filter((sess) => sess.user_id === s.driver_id),
                                      now,
                                    );
                                    if (!status) return null;
                                    const badge = ATTENDANCE_BADGE[status];
                                    return (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                                      >
                                        {badge.label}
                                      </span>
                                    );
                                  })()
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <ShiftRowActions shiftId={s.id} isActive={s.is_active} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </>
    </Page>
  );
}
