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

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  closed: "bg-border text-muted",
};

export default async function RoutesPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: routes }, { data: driverMembers }, { data: vehicles }] = await Promise.all([
    supabase
      .from("routes")
      .select(
        "id, name, origin, destination, scheduled_date, status, closed_at, created_at, assigned_driver_id, assigned_vehicle_id, profiles!routes_assigned_driver_id_fkey(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
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
  ]);

  const drivers = (driverMembers ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    return { id: m.user_id, label: name || p?.email || m.user_id };
  });
  const vehicleOptions = (vehicles ?? []).map((v) => ({ id: v.id, label: vehicleLabel(v) }));

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Routes
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Dispatch</h1>
      </div>

      <div className="mb-6">
        <CreateRouteForm orgId={orgId} drivers={drivers} vehicles={vehicleOptions} />
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
                  <td className="px-4 py-3 text-muted">{r.scheduled_date ?? "—"}</td>
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
