import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/dates";

export default async function AdminDashboardPage() {
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

  const { data: org } = await supabase
    .from("organizations")
    .select("name, compliance_mode, created_at")
    .eq("id", orgId)
    .maybeSingle();

  const thirtyDaysAgo = daysAgoIso(30);

  const [
    { count: memberCount },
    { count: vehicleCount },
    { count: pendingInviteCount },
    { count: unclaimedSlotCount },
    { count: failedInspectionCount },
    { count: incidentCount },
    { count: safetyEventCount },
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
  ]);
  const pendingCount = (pendingInviteCount ?? 0) + (unclaimedSlotCount ?? 0);
  const reviewCount = (failedInspectionCount ?? 0) + (incidentCount ?? 0);
  const safetyCount = safetyEventCount ?? 0;

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

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/roster"
          className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
        >
          <p className="font-semibold">Manage roster</p>
          <p className="mt-1 text-sm text-muted">Invite drivers, review pending invites.</p>
        </Link>
        <Link
          href="/admin/vehicles"
          className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
        >
          <p className="font-semibold">Manage vehicles</p>
          <p className="mt-1 text-sm text-muted">Add vehicles, assign drivers.</p>
        </Link>
        <Link
          href="/admin/ifta"
          className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
        >
          <p className="font-semibold">IFTA state mileage</p>
          <p className="mt-1 text-sm text-muted">Miles per state for the quarter.</p>
        </Link>
        <Link
          href="/admin/reviews"
          className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
        >
          <p className="font-semibold">Inspections & incidents</p>
          <p className="mt-1 text-sm text-muted">DVIR checklists and mid-trip reports.</p>
        </Link>
        <Link
          href="/admin/safety"
          className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
        >
          <p className="font-semibold">Driver safety</p>
          <p className="mt-1 text-sm text-muted">Harsh braking, hard acceleration, speeding.</p>
        </Link>
      </div>

      <p className="mt-10 text-xs text-muted">
        Live map stays mobile-only, by design — the admin&apos;s on-the-go
        phone check.
      </p>
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
