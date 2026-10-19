// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/approvals/page.tsx
//
// Trip approval (sales fleets on Growth, 2026-10-19; modeled on MileIQ for
// Teams' approve/reject drives): the admin approves or rejects each
// finished trip, like an expense report. The sealed trip itself is never
// changed -- the decision lives in trip_approvals.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { getBranchScope } from "@/lib/branch-scope";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import { requireFeature } from "@/lib/fleet-features";
import { daysAgoIso } from "@/lib/dates";
import { DecisionForm } from "./decision-form";

const DAYS = 30;

function vehicleLabel(
  v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null } | null,
) {
  if (!v) return "—";
  const name = [v.make, v.model].filter(Boolean).join(" ");
  return v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "—";
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string | string[] }>;
}) {
  await requireFeature("trip_approval");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const showReviewed = (await searchParams).show === "reviewed";
  const since = daysAgoIso(DAYS).slice(0, 10);

  const [{ data: trips }, { data: approvals }, fleetIds, scope] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, user_id, start_time, total_miles, date_key, profiles!sessions_user_id_fkey(first_name, last_name), vehicles!sessions_vehicle_id_fkey(nickname, make, model, display_id)",
      )
      .eq("organization_id", orgId)
      .eq("is_closed", true)
      .gte("date_key", since)
      .order("start_time", { ascending: false })
      .limit(300),
    supabase
      .from("trip_approvals")
      .select("session_id, status, note")
      .eq("organization_id", orgId)
      .gte("decided_at", daysAgoIso(DAYS + 30)),
    fleetDriverIds(supabase, orgId),
    getBranchScope(orgId),
  ]);

  const decision = new Map((approvals ?? []).map((a) => [a.session_id, a]));
  const rows = (trips ?? [])
    .filter((t) => scope.driverIn(t.user_id))
    .filter((t) => (showReviewed ? decision.has(t.id) : !decision.has(t.id)));

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? "bg-accent text-accent-foreground" : "border border-border hover:border-accent"}`;

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Trip approval</p>
        <h1 className="mt-1 text-2xl font-semibold">Approve driven miles</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Finished trips from the last {DAYS} days. Approve the business miles you reimburse and reject the rest.
          The trip record itself never changes.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <Link href="?" className={tab(!showReviewed)}>
          To review
        </Link>
        <Link href="?show=reviewed" className={tab(showReviewed)}>
          Reviewed
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {showReviewed ? "No reviewed trips yet." : "Nothing to review."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Miles</th>
                <th className="px-4 py-3 font-medium">{showReviewed ? "Decision" : ""}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const p = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
                const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles;
                const d = decision.get(t.id);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">{t.date_key}</td>
                    <td className="px-4 py-2.5">{driverLabel(p, fleetIds.get(t.user_id), "Driver")}</td>
                    <td className="px-4 py-2.5 text-muted">{vehicleLabel(v)}</td>
                    <td className="px-4 py-2.5">{Number(t.total_miles ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-2.5">
                      {d && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "approved" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                          }`}
                        >
                          {d.status === "approved" ? "Approved" : "Rejected"}
                        </span>
                      )}
                      {d?.note && <span className="ml-2 text-xs text-muted">{d.note}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <DecisionForm sessionId={t.id} decided={!!d} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
