import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { InviteForm } from "./invite-form";
import { RemoveButton } from "./remove-button";
import { AddDriverSlotForm } from "./add-driver-slot-form";
import { RemoveSlotButton } from "./remove-slot-button";
import { GenerateReportButton } from "./generate-report-button";
import { OperatorButton } from "./operator-button";
import { AdminButton } from "./admin-button";
import { RowActionsMenu } from "./row-actions-menu";

export default async function RosterPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: members }, { data: allSlots }] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "id, user_id, member_role, is_active, invited_at, joined_at, profiles(first_name, last_name, email)",
      )
      .eq("organization_id", orgId)
      .order("is_active", { ascending: false })
      .order("joined_at", { ascending: false }),
    // Real bug avoided here, not just a missing column (explicit user
    // request, 2026-09-18, adding a "User ID" column): profiles.display_id
    // is a completely different, unrelated ID (format CM-P######, used
    // elsewhere for gig-driver report verification) -- NOT the CM-D####
    // id a fleet driver actually logs in with, which only ever lives on
    // fleet_driver_slots (claimed or not). Fetching every slot for this
    // org (not just the unclaimed ones the old query pulled) so a claimed
    // member's row can show their real login ID, matched below by
    // claimed_by.
    supabase
      .from("fleet_driver_slots")
      .select("id, first_name, last_name, display_id, created_at, claimed_by")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const slots = (allSlots ?? []).filter((s) => !s.claimed_by);
  const displayIdByUserId = new Map(
    (allSlots ?? []).filter((s) => s.claimed_by).map((s) => [s.claimed_by as string, s.display_id]),
  );

  // Explicit user request, 2026-09-18: only an admin/owner can see the
  // "Make operator" control -- an operator could otherwise see the
  // button next to their own peers even though set_member_operator would
  // correctly reject the call server-side either way. Derived from the
  // already-fetched members list instead of a second query -- the
  // caller's own row is already in there.
  const callerRole = (members ?? []).find((m) => m.user_id === user.id)?.member_role;
  const canManageOperators = callerRole === "owner" || callerRole === "admin";
  // Explicit user request, 2026-09-18: "Make admin" is owner-only --
  // set_member_admin itself enforces this server-side regardless, but a
  // plain admin shouldn't even see the control that would try and fail.
  const isOwner = callerRole === "owner";

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          Team
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Drivers</h1>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <InviteForm
          orgId={orgId}
          callerRole={callerRole === "owner" || callerRole === "admin" || callerRole === "operator" ? callerRole : "operator"}
        />
        <AddDriverSlotForm orgId={orgId} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              {/* Explicit user request, 2026-09-18: User ID column,
                  between Name and Email -- the real CM-D#### id a driver
                  actually logs in with (see the query above for why this
                  ISN'T profiles.display_id, a different id entirely). */}
              <th className="px-4 py-3 font-medium">User ID</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {displayIdByUserId.get(m.user_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{p?.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted">{m.member_role}</td>
                  <td className="px-4 py-3">
                    <StatusPill active={m.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActionsMenu>
                      {m.is_active && (
                        <GenerateReportButton driverUserId={m.user_id} driverName={name} />
                      )}
                      {canManageOperators &&
                        m.is_active &&
                        (m.member_role === "driver" || m.member_role === "operator") && (
                          <OperatorButton
                            orgId={orgId}
                            userId={m.user_id}
                            isOperator={m.member_role === "operator"}
                          />
                        )}
                      {isOwner &&
                        m.is_active &&
                        (m.member_role === "driver" ||
                          m.member_role === "operator" ||
                          m.member_role === "admin") && (
                          <AdminButton
                            orgId={orgId}
                            userId={m.user_id}
                            isAdmin={m.member_role === "admin"}
                          />
                        )}
                      {m.member_role !== "owner" && <RemoveButton membershipId={m.id} />}
                    </RowActionsMenu>
                  </td>
                </tr>
              );
            })}
            {slots.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{[s.first_name, s.last_name].join(" ")}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{s.display_id}</td>
                <td className="px-4 py-3 text-muted">—</td>
                <td className="px-4 py-3 capitalize text-muted">driver</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                    Unclaimed
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActionsMenu>
                    <RemoveSlotButton slotId={s.id} />
                  </RowActionsMenu>
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && slots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
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
