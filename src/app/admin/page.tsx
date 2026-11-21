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
import Link from "next/link";
import { nextIftaDeadline, serviceProfile, type KpiKey } from "@/lib/service-profile";

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

  // What each service puts first (src/lib/service-profile.ts): miles, today's trips, geofence alerts, open fuel
  // alerts, trips waiting for approval. Only fetched for the services that show them.
  const sp = serviceProfile(org?.industry_template);
  const wants = new Set(sp.kpis);
  const tz = org?.timezone ?? "America/New_York";
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const [{ data: tripRows }, { count: geofence7 }, { count: fuelOpen }, { data: approvalRows }] = await Promise.all([
    wants.has("miles30") || wants.has("tripsToday") || wants.has("approvals")
      ? supabase
          .from("sessions")
          .select("id, user_id, date_key, total_miles, is_closed, profiles!sessions_user_id_fkey(first_name, last_name)")
          .eq("organization_id", orgId)
          .gte("start_time", thirtyDaysAgo)
          .limit(3000)
      : Promise.resolve({ data: null }),
    wants.has("geofence7") && features.has("geofences")
      ? supabase
          .from("vehicle_geofence_alerts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("created_at", daysAgoIso(7))
      : Promise.resolve({ count: null }),
    wants.has("fuelOpen") && features.has("fuel_alerts")
      ? supabase
          .from("fuel_anomalies")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "open")
      : Promise.resolve({ count: null }),
    wants.has("approvals") && features.has("trip_approval")
      ? supabase.from("trip_approvals").select("session_id").eq("organization_id", orgId)
      : Promise.resolve({ data: null }),
  ]);
  const trips = (tripRows ?? []).filter((t) => scope.driverIn(t.user_id));
  const miles30 = trips.reduce((sum, t) => sum + (Number(t.total_miles) || 0), 0);
  const tripsToday = trips.filter((t) => t.date_key === todayKey).length;
  const decided = new Set((approvalRows ?? []).map((a) => a.session_id));
  const awaitingApproval = trips.filter((t) => t.is_closed && Number(t.total_miles) > 0 && !decided.has(t.id)).length;
  const milesByPerson = new Map<string, { name: string; miles: number }>();
  for (const t of trips) {
    const p = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    const cur = milesByPerson.get(t.user_id) ?? {
      name: driverLabel(p, fleetIds.get(t.user_id), sp.person),
      miles: 0,
    };
    cur.miles += Number(t.total_miles) || 0;
    milesByPerson.set(t.user_id, cur);
  }
  const topPeople = Array.from(milesByPerson.values()).sort((a, b) => b.miles - a.miles).slice(0, 5);

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
    // Header greeting (2026-11-20): who is looking, and as what.
    const { data: me } = await supabase
      .from("organization_members")
      .select("member_role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    return (
      <SchoolDashboard
        orgId={orgId}
        orgName={org.name}
        viewerName={profile?.first_name || user.email?.split("@")[0] || ""}
        viewerRole={me?.member_role ?? null}
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

  const onRoadNow = vehicles.filter((v) => v.onTrip).length;
  const ifta = nextIftaDeadline();
  const dueLabel = ifta.due.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  type Card = { label: string; value: number | string; hint?: string; accent?: boolean; href?: string };
  const lower = (t: string) => t.toLowerCase();
  const cardFor: Record<KpiKey, Card | null> = {
    people: { label: scope.current ? `${sp.people} in branch` : `Active ${lower(sp.people)}`, value: scope.driverIds?.size ?? memberCount ?? 0, href: "/admin/roster" },
    vehicles: { label: sp.vehicles, value: scope.vehicleIds?.size ?? vehicleCount ?? 0, href: "/admin/roster?tab=vehicles" },
    pending: { label: `Pending ${lower(sp.people)}`, value: pendingCount, href: "/admin/roster" },
    review: { label: "Needs review", value: reviewCount, accent: reviewCount > 0, href: "/admin/reviews" },
    safety: features.has("safety_scores") ? { label: "Safety events · 30 days", value: safetyCount, accent: safetyCount > 0, href: "/admin/safety" } : null,
    miles30: { label: "Miles · 30 days", value: Math.round(miles30).toLocaleString("en-US") },
    tripsToday: { label: "Trips today", value: tripsToday },
    onRoad: { label: "On the road now", value: onRoadNow, hint: `of ${vehicles.length} with a location` },
    geofence7: features.has("geofences") ? { label: "Geofence alerts · 7 days", value: geofence7 ?? 0, accent: (geofence7 ?? 0) > 0, href: "/admin/geofences" } : null,
    fuelOpen: features.has("fuel_alerts") ? { label: "Open fuel alerts", value: fuelOpen ?? 0, accent: (fuelOpen ?? 0) > 0, href: "/admin/fuel" } : null,
    approvals: features.has("trip_approval") ? { label: "Trips awaiting approval", value: awaitingApproval, accent: awaitingApproval > 0, href: "/admin/approvals" } : null,
    ifta: features.has("ifta") ? { label: "Next IFTA filing", value: `${ifta.days} days`, hint: `${ifta.quarter} · due ${dueLabel}`, accent: ifta.days <= 14, href: "/admin/ifta" } : null,
  };
  const cards = sp.kpis.map((k) => cardFor[k]).filter((c): c is Card => c !== null);

  // What needs a look, with a link to where it is fixed: only what this service has and only when there is something.
  const attention: { text: string; href: string }[] = [];
  if (reviewCount > 0) attention.push({ text: `${reviewCount} failed ${reviewCount === 1 ? "inspection or incident" : "inspections and incidents"} to review`, href: "/admin/reviews" });
  if ((fuelOpen ?? 0) > 0) attention.push({ text: `${fuelOpen} fuel alert${fuelOpen === 1 ? "" : "s"} to check`, href: "/admin/fuel" });
  if (awaitingApproval > 0) attention.push({ text: `${awaitingApproval} trip${awaitingApproval === 1 ? "" : "s"} waiting for your approval`, href: "/admin/approvals" });
  if ((geofence7 ?? 0) > 0) attention.push({ text: `${geofence7} geofence alert${geofence7 === 1 ? "" : "s"} this week`, href: "/admin/geofences" });
  if (pendingCount > 0) attention.push({ text: `${pendingCount} ${lower(sp.person)}${pendingCount === 1 ? "" : "s"} not joined yet`, href: "/admin/roster" });
  if (features.has("ifta") && ifta.days <= 30) attention.push({ text: `IFTA ${ifta.quarter} return is due ${dueLabel} (${ifta.days} days)`, href: "/admin/ifta" });

  const showTopPeople = topPeople.length > 0 && (wants.has("miles30") || wants.has("tripsToday"));
  const maxMiles = Math.max(1, ...topPeople.map((p) => p.miles));

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <div className="mb-6">
        <p className="text-xs font-medium text-muted">{org?.name}</p>
        <h1 className="text-xl font-semibold tracking-tight">
          {sp.dashboardTitle}
          {scope.current && <span className="text-muted"> · {scope.current.name}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">{sp.dashboardHelp}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {attention.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">Needs your attention</p>
          <ul className="mt-3 divide-y divide-border">
            {attention.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent">
                  <span>{a.text}</span>
                  <span aria-hidden="true" className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {features.has("live_map") && (
        <div className="mt-8">
          <FleetMap orgId={orgId} initialVehicles={vehicles} geofences={mapGeofences ?? []} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {showTopPeople && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold">Miles by {lower(sp.person)} · 30 days</p>
            <ul className="mt-4 space-y-3">
              {topPeople.map((p) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-muted">{Math.round(p.miles).toLocaleString("en-US")} mi</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-border">
                    <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(3, (p.miles / maxMiles) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(features.has("routes") || features.has("school")) && (
          <RouteEfficiencyChart statusCounts={statusCounts} avgCycleHours={avgCycleHours} />
        )}
        <DriverStartTimesChart series={driverSeries} />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
  href?: string;
}) {
  const body = (
    <div className={`h-full rounded-xl border p-5 ${accent ? "border-danger/40 bg-danger/5" : "border-border bg-surface"} ${href ? "transition hover:border-accent" : ""}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${accent ? "text-danger" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
