import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { inspectionCategoryLabel, incidentCategoryLabel } from "@/lib/inspection-catalog";

type InspectionItem = {
  category: string;
  status: "ok" | "defect";
  note?: string;
};

function driverName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "—";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "—";
}

function vehicleLabel(v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

export default async function ReviewsPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: inspections }, { data: incidents }] = await Promise.all([
    supabase
      .from("vehicle_inspections")
      .select(
        "id, inspection_type, overall_status, items, odometer, created_at, profiles(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("trip_incidents")
      .select(
        "id, category, description, created_at, profiles(first_name, last_name), vehicles(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Reviews
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Inspections & incidents</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Driver-submitted pre/post-trip checklists and mid-trip incident
          reports. Read-only — drivers submit these from the mobile app.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">Vehicle inspections</h2>
        <div className="space-y-3">
          {(inspections ?? []).map((i) => {
            const p = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
            const v = Array.isArray(i.vehicles) ? i.vehicles[0] : i.vehicles;
            const items = (i.items ?? []) as InspectionItem[];
            const defects = items.filter((it) => it.status === "defect");
            const isFail = i.overall_status === "fail";

            return (
              <div
                key={i.id}
                className={`rounded-xl border bg-surface p-4 ${isFail ? "border-danger/40" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{driverName(p)}</p>
                    <p className="text-xs text-muted">
                      {vehicleLabel(v)} · {i.inspection_type === "pre_trip" ? "Pre-trip" : "Post-trip"} ·{" "}
                      {new Date(i.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isFail ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                    }`}
                  >
                    {isFail ? "Defects found" : "Pass"}
                  </span>
                </div>
                {defects.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                    {defects.map((d, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{inspectionCategoryLabel(d.category)}</span>
                        {d.note && <span className="text-muted"> — {d.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {(inspections ?? []).length === 0 && (
            <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              No inspections submitted yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Trip incidents</h2>
        <div className="space-y-3">
          {(incidents ?? []).map((inc) => {
            const p = Array.isArray(inc.profiles) ? inc.profiles[0] : inc.profiles;
            const v = Array.isArray(inc.vehicles) ? inc.vehicles[0] : inc.vehicles;
            return (
              <div key={inc.id} className="rounded-xl border border-danger/40 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{driverName(p)}</p>
                    <p className="text-xs text-muted">
                      {vehicleLabel(v)} · {new Date(inc.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">
                    {incidentCategoryLabel(inc.category)}
                  </span>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-sm">{inc.description}</p>
              </div>
            );
          })}
          {(incidents ?? []).length === 0 && (
            <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              No incidents reported.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
