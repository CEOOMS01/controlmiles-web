// School transportation (2026-10-09): school routes -- an ordered list of
// stops a driver runs every service day (AM to school, PM home). Stops and
// riders are edited on each route's page.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { busLabel, loadCrewOptions } from "@/lib/school-crew";
import { ROUTE_TYPE_LABEL, clock, daysLabel } from "@/lib/school";
import { CreateSchoolRouteForm } from "./create-school-route-form";

export default async function SchoolRoutesPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const [
    { data: routes },
    { data: schools },
    crew,
    { data: stops },
    { data: riders },
    { data: me },
    fleetIds,
  ] = await Promise.all([
    supabase
      .from("routes")
      .select(
        "id, name, route_type, service_days, scheduled_start_time, status, assigned_driver_id, school_site_id, monitor_name, profiles!routes_assigned_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .in("route_type", ["school_am", "school_pm"])
      .neq("status", "closed")
      .order("scheduled_start_time", { ascending: true, nullsFirst: false }),
    supabase.from("school_sites").select("id, name").eq("organization_id", orgId).order("name"),
    loadCrewOptions(supabase, orgId),
    supabase.from("route_stops").select("route_id").eq("organization_id", orgId),
    supabase.from("student_stop_assignments").select("route_id, action").eq("organization_id", orgId),
    supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
    fleetDriverIds(supabase, orgId),
  ]);

  const timeFormat: "12h" | "24h" = me?.time_format === "24h" ? "24h" : "12h";
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const stopCount = new Map<string, number>();
  for (const s of stops ?? []) stopCount.set(s.route_id, (stopCount.get(s.route_id) ?? 0) + 1);
  const riderCount = new Map<string, number>();
  for (const r of riders ?? []) if (r.action === "board") riderCount.set(r.route_id, (riderCount.get(r.route_id) ?? 0) + 1);

  return (
    <main className="space-y-6 px-6 py-10 sm:px-10">
      <div>
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">School transportation</p>
        <h1 className="mt-1 text-2xl font-semibold">School routes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Create the route, then open it to add its stops in order and the students who get on or off at
          each one. The driver sees it in the app on its service days.
        </p>
      </div>

      <CreateSchoolRouteForm
        schools={(schools ?? []).map((s) => ({ id: s.id, label: s.name }))}
        drivers={crew.drivers}
        vehicles={crew.vehicles}
        timeFormat={timeFormat}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Driver</th>
              <th className="px-4 py-3 font-medium">Monitor</th>
              <th className="px-4 py-3 font-medium">Bus</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Stops</th>
              <th className="px-4 py-3 font-medium">Riders</th>
            </tr>
          </thead>
          <tbody>
            {(routes ?? []).map((r) => {
              const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/school/routes/${r.id}`} className="font-medium text-accent hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {ROUTE_TYPE_LABEL[r.route_type]}
                      {r.school_site_id ? ` · ${schoolName.get(r.school_site_id) ?? ""}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {driverLabel(p, r.assigned_driver_id ? fleetIds.get(r.assigned_driver_id) : null)}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.monitor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{busLabel(v, "—")}</td>
                  <td className="px-4 py-3 text-muted">
                    {clock(r.scheduled_start_time, timeFormat)} · {daysLabel(r.service_days)}
                  </td>
                  <td className="px-4 py-3 text-muted">{stopCount.get(r.id) ?? 0}</td>
                  <td className="px-4 py-3 text-muted">{riderCount.get(r.id) ?? 0}</td>
                </tr>
              );
            })}
            {(routes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No school routes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
