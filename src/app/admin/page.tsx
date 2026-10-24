import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBranchScope } from "@/lib/branch-scope";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { daysAgoIso } from "@/lib/dates";
import { FleetMap, type FleetVehicle } from "./fleet-map";
import { getOrgFeatures } from "@/lib/fleet-features";
import { RouteEfficiencyChart, type RouteStatusCount } from "./route-efficiency-chart";
import { DriverStartTimesChart, type DriverStartSeries } from "./driver-start-times-chart";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { SchoolDashboard } from "./school-dashboard";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, compliance_mode, created_at, industry_template, timezone")
    .eq("id", orgId)
    .maybeSingle();

  // Only what this fleet's service and plan include (fn_org_features).
  const features = await getOrgFeatures(orgId);
  // School bus plans with the live run board: that board is their dashboard
  // (it already has the map), so the fleet dashboard is not shown twice.
  if (features.has("school_live")) redirect("/admin/school");

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
    { data: mapGeofences },
    fleetIds,
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
      .select("id, display_id, nickname, last_latitude, last_longitude, last_speed, last_location_at, active_session_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .not("last_latitude", "is", null)
      .not("last_longitude", "is", null),
    supabase.from("routes").select("status, created_at, closed_at").eq("organization_id", orgId),
    supabase
      .from("sessions")
      .select("user_id, start_time, profiles!sessions_user_id_fkey(first_name, last_name)")
      .eq("organization_id", orgId)
      .gte("start_time", fourteenDaysAgo)
      .order("start_time", { ascending: true }),
    supabase
      .from("vehicle_geofences")
      .select("id, center_latitude, center_longitude, radius_meters, is_active")
      .eq("organization_id", orgId),
    fleetDriverIds(supabase, orgId),
  ]);

  // Branch filter (sidebar, 2026-09-30).
  const scope = await getBranchScope(orgId);

  const pendingCount = (pendingInviteCount ?? 0) + (unclaimedSlotCount ?? 0);
  const reviewCount = (failedInspectionCount ?? 0) + (incidentCount ?? 0);
  const safetyCount = safetyEventCount ?? 0;

  const vehicles: FleetVehicle[] = (mapVehicles ?? []).filter((v) => scope.vehicleIn(v.id)).map((v) => ({
    id: v.id,
    displayId: v.display_id,
    label: v.nickname || v.display_id || "Vehicle",
    lat: v.last_latitude as number,
    lon: v.last_longitude as number,
    speed: v.last_speed,
    lastLocationAt: v.last_location_at,
    onTrip: v.active_session_id != null,
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
  const seriesMap = new Map<string, DriverStartSeries>();
  for (const row of sessionRows ?? []) {
    if (!row.start_time || !scope.driverIn(row.user_id)) continue;
    if (!seriesMap.has(row.user_id)) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      seriesMap.set(row.user_id, {
        driverId: row.user_id,
        driverName: driverLabel(p, fleetIds.get(row.user_id), "Driver"),
        starts: [],
      });
    }
    seriesMap.get(row.user_id)!.starts.push(row.start_time);
  }
  const driverSeries = Array.from(seriesMap.values())
    .slice(0, 6); // keep the chart legible -- see Baymard-style "avoid dashboard fatigue" note in the chart's own header

  // Driving schools get their own dashboard (2026-10-20): lessons,
  // students and what needs attention, each block per plan.
  if (org?.industry_template === "driving_school") {
    return (
      <SchoolDashboard
        orgId={orgId}
        orgName={org.name}
        timeZone={org.timezone ?? "America/New_York"}
        features={features}
        scope={scope}
        map={
          features.has("live_map") ? (
            <FleetMap orgId={orgId} initialVehicles={vehicles} geofences={mapGeofences ?? []} />
          ) : null
        }
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <div className="mb-6">
        <p className="text-xs font-medium text-muted">
          {org?.name}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Fleet dashboard{scope.current && <span className="text-muted"> · {scope.current.name}</span>}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={scope.current ? "Drivers in branch" : "Active drivers"} value={scope.driverIds?.size ?? memberCount ?? 0} />
        <StatCard label="Vehicles" value={scope.vehicleIds?.size ?? vehicleCount ?? 0} />
        <StatCard label="Pending drivers" value={pendingCount} />
        <StatCard label="Needs review" value={reviewCount} accent={reviewCount > 0} />
        {features.has("safety_scores") && (
          <StatCard label="Safety events (30d)" value={safetyCount} accent={safetyCount > 0} />
        )}
      </div>

      {features.has("live_map") && (
        <div className="mt-10">
          <FleetMap orgId={orgId} initialVehicles={vehicles} geofences={mapGeofences ?? []} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(features.has("routes") || features.has("school")) && (
          <RouteEfficiencyChart statusCounts={statusCounts} avgCycleHours={avgCycleHours} />
        )}
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
