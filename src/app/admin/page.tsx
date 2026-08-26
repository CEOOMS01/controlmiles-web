import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const [{ count: memberCount }, { count: vehicleCount }, { count: pendingCount }] =
    await Promise.all([
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
    ]);

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          {org?.name}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Fleet dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active drivers" value={memberCount ?? 0} />
        <StatCard label="Vehicles" value={vehicleCount ?? 0} />
        <StatCard label="Pending invites" value={pendingCount ?? 0} />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
      </div>

      <p className="mt-10 text-xs text-muted">
        Live map, DVIR review, and route creation stay on the roadmap —
        the mobile app still covers live map and inspections today.
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
