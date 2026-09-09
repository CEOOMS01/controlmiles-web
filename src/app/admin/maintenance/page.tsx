import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";

const TYPE_LABELS: Record<string, string> = {
  oil_change: "Oil change",
  tire_rotation: "Tire rotation",
  brake_service: "Brake service",
  inspection: "Inspection",
  registration: "Registration",
  battery: "Battery",
  other: "Other",
};

function vehicleLabel(v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: records } = await supabase
    .from("vehicle_maintenance_records")
    .select(
      "id, type, performed_at, odometer_at_service, next_due_date, next_due_odometer, cost, notes, vehicles(nickname, make, model, display_id)",
    )
    .eq("organization_id", orgId)
    .order("performed_at", { ascending: false })
    .limit(100);

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Maintenance
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Vehicle maintenance log</h1>
        <p className="mt-2 text-sm text-muted">
          Read-only — drivers log service records from the mobile app.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Vehicle</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Odometer</th>
              <th className="px-4 py-3 font-medium">Next due</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {(records ?? []).map((r) => {
              const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{vehicleLabel(v)}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[r.type] ?? r.type}</td>
                  <td className="px-4 py-3 text-muted">{r.performed_at}</td>
                  <td className="px-4 py-3 text-muted tabular-nums">
                    {r.odometer_at_service ? Number(r.odometer_at_service).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.next_due_date ?? (r.next_due_odometer ? `${Number(r.next_due_odometer).toLocaleString()} mi` : "—")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.cost ? `$${Number(r.cost).toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
            {(records ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No maintenance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
