import { createClient } from "@/lib/supabase/server";
import { AddVehicleForm } from "./add-vehicle-form";
import { AssignDriverSelect, ArchiveButton } from "./vehicle-row-actions";

export default async function VehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: vehicles }, { data: driverMembers }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, display_id, nickname, make, model, year, plate, assigned_driver_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("user_id, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
      .eq("member_role", "driver")
      .eq("is_active", true),
  ]);

  const drivers = (driverMembers ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    return { id: m.user_id, label: name || p?.email || m.user_id };
  });

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            Vehicles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Fleet vehicles</h1>
        </div>
      </div>

      <div className="mb-6">
        <AddVehicleForm orgId={orgId} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Plate</th>
              <th className="px-4 py-3 font-medium">Assigned driver</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(vehicles ?? []).map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-muted">{v.display_id}</td>
                <td className="px-4 py-3">
                  {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                  {v.nickname ? ` "${v.nickname}"` : ""}
                </td>
                <td className="px-4 py-3 text-muted">{v.plate ?? "—"}</td>
                <td className="px-4 py-3">
                  <AssignDriverSelect
                    vehicleId={v.id}
                    currentDriverId={v.assigned_driver_id}
                    drivers={drivers}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ArchiveButton vehicleId={v.id} />
                </td>
              </tr>
            ))}
            {(vehicles ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No vehicles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
