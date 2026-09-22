import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GrowthUpsell } from "../growth-upsell";
import { ShiftForm } from "./shift-form";
import { ShiftRowActions } from "./shift-row-actions";

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

export default async function ShiftsPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: tier } = await supabase.rpc("fn_org_effective_tier", { p_org_id: orgId });
  const isGrowth = tier === "growth" || tier === "enterprise";
  const isEnterprise = tier === "enterprise";

  const now = new Date();
  const todayDow = now.getUTCDay();
  const todayDateKey = now.toISOString().slice(0, 10);

  const [{ data: shifts }, { data: driverMembers }, { data: todaysSessions }, { data: vehicles }, { data: myProfile }] =
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
    ]);

  const timeFormat: "12h" | "24h" = myProfile?.time_format === "24h" ? "24h" : "12h";

  const drivers = (driverMembers ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    return { id: m.user_id, label: name || p?.email || m.user_id };
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
    const driverName = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Driver";
    if (!byDriver.has(s.driver_id)) byDriver.set(s.driver_id, { driverName, rows: [] });
    byDriver.get(s.driver_id)!.rows.push(s);
  }

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Shifts</p>
        <h1 className="mt-1 text-2xl font-semibold">Work schedule</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A recurring weekly schedule per driver — separate from Routes, which dispatches a
          specific trip on a specific date.
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
