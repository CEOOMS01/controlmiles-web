import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { daysAgoIso } from "@/lib/dates";
import { FleetMap, type FleetVehicle } from "./fleet-map";
import { RouteEfficiencyChart, type RouteStatusCount } from "./route-efficiency-chart";
import { DriverStartTimesChart, type DriverStartSeries } from "./driver-start-times-chart";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, compliance_mode, created_at")
    .eq("id", orgId)
    .maybeSingle();

  const thirtyDaysAgo = daysAgoIso(30);
  const fourteenDaysAgo = daysAgoIso(14);

  const [
    { count: memberCount },
    { count: vehicleCount },
    { count: pendingInviteCount },
    { count: unclaimedSlotCount },
    { count: failedInspectionCount },
    { count: incidentCount },
    { count: safetyEventCount },
    { data: mapVehicles },
    { data: routeRows },
    { data: sessionRows },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", true),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_archived", false),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", false),
    supabase
      .from("fleet_driver_slots")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("claimed_by", null),
    supabase
      .from("vehicle_inspections")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("overall_status", "fail"),
    supabase
      .from("trip_incidents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("driver_safety_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("recorded_at", thirtyDaysAgo),
    supabase
      .from("vehicles")
      .select("id, display_id, nickname, last_latitude, last_longitude, last_speed, last_location_at")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .not("last_latitude", "is", null)
      .not("last_longitude", "is", null),
    supabase.from("routes").select("status, created_at, closed_at").eq("organization_id", orgId),
    supabase
      .from("sessions")
      .select("user_id, start_time, profiles(first_name, last_name)")
      .eq("organization_id", orgId)
      .gte("start_time", fourteenDaysAgo)
      .order("start_time", { ascending: true }),
  ]);

  const pendingCount = (pendingInviteCount ?? 0) + (unclaimedSlotCount ?? 0);
  const reviewCount = (failedInspectionCount ?? 0) + (incidentCount ?? 0);
  const safetyCount = safetyEventCount ?? 0;

  const vehicles: FleetVehicle[] = (mapVehicles ?? []).map((v) => ({
    id: v.id,
    displayId: v.display_id,
    label: v.nickname || v.display_id || "Vehicle",
    lat: v.last_latitude as number,
    lon: v.last_longitude as number,
    speed: v.last_speed,
    lastLocationAt: v.last_location_at,
  }));

  const routeStatusOrder = ["draft", "active", "closed"];
  const statusCounts: RouteStatusCount[] = routeStatusOrder.map((status) => ({
    status,
    count: (routeRows ?? []).filter((r) => r.status === status).length,
  }));
  const closedRoutes = (routeRows ?? []).filter((r) => r.status === "closed" && r.closed_at);
  const avgCycleHours =
    closedRoutes.length > 0
      ? closedRoutes.reduce((sum, r) => {
          const hours =
            (new Date(r.closed_at as string).getTime() - new Date(r.created_at).getTime()) /
            3_600_000;
          return sum + hours;
        }, 0) / closedRoutes.length
      : null;

  // First session start time, per driver per day -- see
  // driver-start-times-chart.tsx's own header comment for why this (and
  // not "minutes late vs. schedule") is the honest metric available.
  const byDriverDay = new Map<string, { driverId: string; driverName: string; date: string; hour: number }>();
  for (const row of sessionRows ?? []) {
    if (!row.start_time) continue;
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const driverName = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Driver";
    const start = new Date(row.start_time);
    const date = start.toISOString().slice(0, 10);
    const hour = start.getUTCHours() + start.getUTCMinutes() / 60;
    const key = `${row.user_id}|${date}`;
    const existing = byDriverDay.get(key);
    if (!existing || hour < existing.hour) {
      byDriverDay.set(key, { driverId: row.user_id, driverName, date, hour });
    }
  }
  const seriesMap = new Map<string, DriverStartSeries>();
  for (const { driverId, driverName, date, hour } of byDriverDay.values()) {
    if (!seriesMap.has(driverId)) {
      seriesMap.set(driverId, { driverId, driverName, points: [] });
    }
    seriesMap.get(driverId)!.points.push({ date, hour });
  }
  const driverSeries = Array.from(seriesMap.values())
    .map((s) => ({ ...s, points: s.points.sort((a, b) => a.date.localeCompare(b.date)) }))
    .slice(0, 6); // keep the chart legible -- see Baymard-style "avoid dashboard fatigue" note in the chart's own header

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          {org?.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Fleet dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active drivers" value={memberCount ?? 0} />
        <StatCard label="Vehicles" value={vehicleCount ?? 0} />
        <StatCard label="Pending drivers" value={pendingCount} />
        <StatCard label="Needs review" value={reviewCount} accent={reviewCount > 0} />
        <StatCard label="Safety events (30d)" value={safetyCount} accent={safetyCount > 0} />
      </div>

      <div className="mt-10">
        <FleetMap orgId={orgId} initialVehicles={vehicles} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RouteEfficiencyChart statusCounts={statusCounts} avgCycleHours={avgCycleHours} />
        <DriverStartTimesChart series={driverSeries} />
      </div>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${accent ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}
