import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { GeofenceCreator } from "./geofence-creator";
import { GeofenceList } from "./geofence-list";

export default async function GeofencesPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: vehicles }, { data: geofences }, { data: alerts }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, nickname, display_id, make, model, last_latitude, last_longitude")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_geofences")
      .select("id, vehicle_id, name, center_latitude, center_longitude, radius_meters, is_active")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_geofence_alerts")
      .select("id, vehicle_id, geofence_id, distance_meters, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const vehicleLabel = (v: { nickname: string | null; display_id: string | null; make: string | null; model: string | null }) =>
    v.nickname || [v.make, v.model].filter(Boolean).join(" ") || v.display_id || "Vehicle";

  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const geofenceById = new Map((geofences ?? []).map((g) => [g.id, g]));

  const mapVehicles = (vehicles ?? [])
    .filter((v) => v.last_latitude != null && v.last_longitude != null)
    .map((v) => ({
      id: v.id,
      label: vehicleLabel(v),
      lat: v.last_latitude as number,
      lon: v.last_longitude as number,
    }));

  const selectableVehicles = (vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) }));

  const listRows = (geofences ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    vehicleLabel: vehicleById.has(g.vehicle_id) ? vehicleLabel(vehicleById.get(g.vehicle_id)!) : "—",
    radius_meters: g.radius_meters,
    is_active: g.is_active,
  }));

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Geofences</p>
        <h1 className="mt-1 text-2xl font-semibold">Vehicle zones</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Draw a circle around a vehicle&apos;s expected area — an alert is logged the moment its GPS
          crosses it. Circle-based zones, checked server-side on every location update.
        </p>
      </div>

      <div className="mb-10">
        <GeofenceCreator
          orgId={orgId}
          mapVehicles={mapVehicles}
          selectableVehicles={selectableVehicles}
          existing={geofences ?? []}
        />
      </div>

      <div className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Zones</h2>
        <GeofenceList rows={listRows} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent crossings</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(alerts ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{geofenceById.get(a.geofence_id)?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {vehicleById.has(a.vehicle_id) ? vehicleLabel(vehicleById.get(a.vehicle_id)!) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{Math.round(a.distance_meters).toLocaleString()} m out</td>
                  <td className="px-4 py-3 text-muted">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(alerts ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No crossings recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
