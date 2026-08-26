import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { RemoveButton } from "./remove-button";

export default async function RosterPage() {
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

  const { data: members } = await supabase
    .from("organization_members")
    .select(
      "id, member_role, is_active, invited_at, joined_at, profiles(first_name, last_name, email, display_id)",
    )
    .eq("organization_id", orgId)
    .order("is_active", { ascending: false })
    .order("joined_at", { ascending: false });

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Roster
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Drivers</h1>
      </div>

      <div className="mb-6">
        <InviteForm orgId={orgId} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => {
              const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{name}</td>
                  <td className="px-4 py-3 text-muted">{p?.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted">{m.member_role}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={m.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.member_role !== "owner" && <RemoveButton membershipId={m.id} />}
                  </td>
                </tr>
              );
            })}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No drivers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-success/15 text-success"
          : "bg-accent/15 text-accent"
      }`}
    >
      {active ? "Active" : "Pending"}
    </span>
  );
}
