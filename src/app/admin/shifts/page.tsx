import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GrowthUpsell } from "../growth-upsell";
import { ShiftForm } from "./shift-form";
import { ShiftRowActions } from "./shift-row-actions";
import { ClassBlockForm } from "./class-block-form";
import { ClassBlockActions } from "./class-block-actions";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";

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
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: tier } = await supabase.rpc("fn_org_effective_tier", { p_org_id: orgId });
  const isGrowth = tier === "growth" || tier === "enterprise";
  const isEnterprise = tier === "enterprise";

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("timezone, shift_start_window_minutes, industry_template")
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
  const selectedDate =
    typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : local.date;
  // Classes exist only for the Driving school industry template.
  const hasClasses = orgRow?.industry_template === "driving_school";
  const { data: dayBlocks } = isGrowth && hasClasses
    ? await supabase.rpc("get_org_shift_day", { p_org: orgId, p_date: selectedDate })
    : { data: [] as ClassBlock[] };

  const [{ data: shifts }, { data: driverMembers }, { data: todaysSessions }, { data: vehicles }, { data: myProfile }, fleetIds] =
    await Promise.all([
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
        .eq("member_role", "driver")
        .eq("is_active", true),
      isEnterprise
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

  const vehicleLabel = (v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) => {
    if (!v) return null;
    const name = [v.make, v.model].filter(Boolean).join(" ");
    return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || null;
  };
  const vehicleOptions = (vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) ?? "Vehicle" }));

  // Grouped by driver -- one card per driver, days listed inside, instead
  // of a flat table where the same driver's name repeats on every row.
  const byDriver = new Map<
    string,
    { driverName: string; rows: NonNullable<typeof shifts>[number][] }
  >();
  for (const s of shifts ?? []) {
    const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const driverName = driverLabel(p, fleetIds.get(s.driver_id), "Driver");
    if (!byDriver.has(s.driver_id)) byDriver.set(s.driver_id, { driverName, rows: [] });
    byDriver.get(s.driver_id)!.rows.push(s);
  }

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Shifts</p>
        <h1 className="mt-1 text-2xl font-semibold">Work schedule</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {hasClasses
            ? "When each instructor works: a weekly template plus hourly classes on specific dates. Separate from Routes, which dispatches a specific trip."
            : "A recurring weekly schedule per driver. Separate from Routes, which dispatches a specific trip on a specific date."}
        </p>
      </div>

      {!isGrowth ? (
        <GrowthUpsell feature="Shift scheduling" />
      ) : (
        <>
          {!isEnterprise && (
            <div className="mb-6 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
              <span className="font-medium text-foreground">Enterprise</span> adds live attendance
              status — on time, late start, or running into overtime — checked against each
              driver&apos;s real GPS trip start, not just the schedule.
            </div>
          )}
          {hasClasses && (<>
          {/* Day schedule: hourly classes for one date (driving-school
              style) -- the weekly template below materialized for that
              date plus one-off classes. See migration
              20260929170000_hourly_shift_blocks.sql. */}
          <section className="mb-10">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Day schedule</h2>
                <p className="text-sm text-muted">
                  Hourly classes for one day. Drivers can start a class from {windowMin} min before
                  to {windowMin} min after its start; between classes nothing is tracked and their
                  day stays open until they end it.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <a
                  href={`?date=${shiftDate(selectedDate, -1)}`}
                  className="rounded-lg border border-border px-3 py-1.5 hover:border-accent"
                  aria-label="Previous day"
                >
                  ←
                </a>
                <form method="get" className="flex items-center gap-2">
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
                  href={`?date=${shiftDate(selectedDate, 1)}`}
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
            </div>

            <div className="mb-4">
              <ClassBlockForm
                orgId={orgId}
                drivers={drivers}
                vehicles={vehicleOptions}
                timeFormat={timeFormat}
                defaultDate={selectedDate}
              />
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
                                  {formatTimeOfDay(b.start_time, timeFormat)}–{formatTimeOfDay(b.end_time, timeFormat)}
                                </td>
                                <td className="px-4 py-2.5 text-muted">
                                  {b.vehicle_id ? vehicleNames.get(b.vehicle_id) ?? "Vehicle" : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-muted">{b.note ?? ""}</td>
                                <td className="px-4 py-2.5 text-xs text-muted">
                                  {b.source === "template" ? "Weekly" : "One-off"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <ClassBlockActions blockId={b.id} status={b.status} isOneOff={b.source === "one_off"} />
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

          <h2 className="mb-3 text-lg font-semibold">Weekly template</h2>
          </>)}
          <div className="mb-8">
            <ShiftForm orgId={orgId} drivers={drivers} vehicles={vehicleOptions} timeFormat={timeFormat} />
          </div>

          {byDriver.size === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No shifts scheduled yet.
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
                                <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                                  Paused
                                </span>
                              ) : (
                                isEnterprise &&
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
    </main>
  );
}
