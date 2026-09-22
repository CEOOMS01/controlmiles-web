import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GrowthUpsell } from "../growth-upsell";
import { ShiftForm } from "./shift-form";
import { ShiftRowActions } from "./shift-row-actions";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const isGrowth = tier === "growth";

  const [{ data: shifts }, { data: driverMembers }, { data: vehicles }, { data: myProfile }] =
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
                              {formatTimeOfDay(s.start_time, timeFormat)}–{formatTimeOfDay(s.end_time, timeFormat)}
                            </td>
                            <td className="px-4 py-2.5 text-muted">{vehicleLabel(v) ?? "—"}</td>
                            <td className="px-4 py-2.5 text-muted">{s.notes ?? ""}</td>
                            <td className="px-4 py-2.5">
                              {!s.is_active && (
                                <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">
                                  Paused
                                </span>
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
