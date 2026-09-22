import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { CreateRouteForm } from "./create-route-form";
import { RouteRowActions } from "./route-row-actions";

function driverName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
}

function vehicleLabel(v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

// scheduled_start_time/end_time are plain `time` columns (HH:MM:SS, no
// date/timezone) -- formatted directly as a string instead of round-
// tripping through Date, which would need a fake date attached and could
// silently shift by a timezone offset.
function formatTimeOfDay(t: string | null, timeFormat: "12h" | "24h") {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hour = Number(h);
  if (timeFormat === "24h") return `${String(hour).padStart(2, "0")}:${m}`;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${period}`;
}

function formatScheduledRange(
  date: string | null,
  start: string | null,
  end: string | null,
  timeFormat: "12h" | "24h",
) {
  if (!date) return "—";
  const startLabel = formatTimeOfDay(start, timeFormat);
  const endLabel = formatTimeOfDay(end, timeFormat);
  if (!startLabel && !endLabel) return date;
  if (startLabel && endLabel) return `${date}, ${startLabel}–${endLabel}`;
  return `${date}, ${startLabel ?? endLabel}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  closed: "bg-border text-muted",
};

// Light Shifts integration (explicit user request, 2026-09-22): informs,
// never blocks -- a route can still be created/dispatched outside a
// driver's scheduled shift (real fleets have exceptions), this just
// surfaces it instead of silently saying nothing. `date` is the plain
// scheduled_date string (YYYY-MM-DD); parsed as UTC noon so a date-only
// value can never roll to the adjacent day depending on the server's
// timezone before extracting its day-of-week.
function shiftMatchStatus(
  shifts: { driver_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean }[],
  driverId: string | null,
  date: string | null,
  startTime: string | null,
): "in_shift" | "outside_shift" | "no_shift_data" | null {
  if (!driverId || !date) return null;
  const driverShifts = shifts.filter((s) => s.driver_id === driverId && s.is_active);
  if (driverShifts.length === 0) return null;

  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayShifts = driverShifts.filter((s) => s.day_of_week === dayOfWeek);
  if (dayShifts.length === 0) return "no_shift_data";
  if (!startTime) return "no_shift_data";

  const inRange = dayShifts.some((s) => startTime >= s.start_time && startTime < s.end_time);
  return inRange ? "in_shift" : "outside_shift";
}

const SHIFT_BADGE: Record<string, { label: string; className: string }> = {
  in_shift: { label: "In shift", className: "bg-success/15 text-success" },
  outside_shift: { label: "Outside shift", className: "bg-danger/15 text-danger" },
  no_shift_data: { label: "No shift that day", className: "bg-border text-muted" },
};

export default async function RoutesPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: routes }, { data: myProfile }, { data: driverMembers }, { data: vehicles }, { data: shifts }] = await Promise.all([
    supabase
      .from("routes")
      .select(
        "id, name, origin, destination, scheduled_date, scheduled_start_time, scheduled_end_time, status, closed_at, created_at, assigned_driver_id, assigned_vehicle_id, profiles!routes_assigned_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("user_id, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
      .eq("member_role", "driver")
      .eq("is_active", true),
    supabase
      .from("vehicles")
      .select("id, nickname, make, model, display_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase
      .from("shifts")
      .select("driver_id, day_of_week, start_time, end_time, is_active")
      .eq("organization_id", orgId),
  ]);

  const drivers = (driverMembers ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    return { id: m.user_id, label: name || p?.email || m.user_id };
  });
  const vehicleOptions = (vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) }));
  const timeFormat: "12h" | "24h" = myProfile?.time_format === "24h" ? "24h" : "12h";

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Routes
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Dispatch</h1>
      </div>

      <div className="mb-6">
        <CreateRouteForm orgId={orgId} drivers={drivers} vehicles={vehicleOptions} timeFormat={timeFormat} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Scheduled</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(routes ?? []).map((r) => {
              const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    {(r.origin || r.destination) && (
                      <p className="text-xs text-muted">
                        {r.origin ?? "?"} → {r.destination ?? "?"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{driverName(p)}</td>
                  <td className="px-4 py-3 text-muted">{vehicleLabel(v)}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatScheduledRange(r.scheduled_date, r.scheduled_start_time, r.scheduled_end_time, timeFormat)}
                    {(() => {
                      const status = shiftMatchStatus(
                        shifts ?? [],
                        r.assigned_driver_id,
                        r.scheduled_date,
                        r.scheduled_start_time,
                      );
                      if (!status) return null;
                      const badge = SHIFT_BADGE[status];
                      return (
                        <span
                          className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RouteRowActions
                      routeId={r.id}
                      status={r.status}
                      currentDriverId={r.assigned_driver_id}
                      currentVehicleId={r.assigned_vehicle_id}
                      drivers={drivers}
                      vehicles={vehicleOptions}
                    />
                  </td>
                </tr>
              );
            })}
            {(routes ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No routes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
