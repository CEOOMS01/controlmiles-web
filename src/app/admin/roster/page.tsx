import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AddDriverForm } from "./add-driver-form";
import { RemoveButton } from "./remove-button";
import { ResendInviteButton } from "./resend-invite-button";
import { describeInvite, latestInviteBySlot, type InviteRow } from "@/lib/invites";
import { RemoveSlotButton } from "./remove-slot-button";
import { GenerateReportButton } from "./generate-report-button";
import { OperatorButton } from "./operator-button";
import { AdminButton } from "./admin-button";
import { RowActionsMenu } from "./row-actions-menu";
import { DriverVehicleSelect } from "./driver-vehicle-select";
import { AddVehicleForm } from "../vehicles/add-vehicle-form";
import { ArchiveButton } from "../vehicles/vehicle-row-actions";
import { getBranchScope } from "@/lib/branch-scope";
import { MemberBranchSelect, VehicleBranchSelect } from "../branch-controls";

// Team+Vehicles unification (explicit user request, 2026-09-23): this
// used to be two separate pages/nav items -- "who's on the team" and
// "which vehicles exist" were really the same fleet-admin question asked
// from two directions, and answering "who's driving what" meant jumping
// between them. One page now: each driver row carries its own vehicle
// picker (DriverVehicleSelect, the inverse of the old AssignDriverSelect
// vehicle-row component, still used below for vehicles nobody's
// driving). /admin/vehicles itself now just redirects here (see that
// page's own comment) rather than disappearing outright, in case
// anything still links to the old URL.
export default async function RosterPage() {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: members }, { data: allSlots }, { data: vehicles }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "id, user_id, member_role, is_active, invited_at, joined_at, branch_id, any_branch, profiles(first_name, last_name, email)",
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
    supabase
      .from("vehicles")
      .select("id, display_id, nickname, make, model, year, plate, assigned_driver_id, ownership, branch_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    // Email invitations (never the token hash): what turns an "Unclaimed"
    // row into Invited / Invite expired, with a Resend action. Operators can
    // read these too (see migration 20260926120000).
    supabase
      .from("driver_invites")
      .select("id, email, status, expires_at, created_at, slot_id, intended_role")
      .eq("organization_id", orgId)
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false }),
  ]);

  // Branch filter (sidebar): drivers of the branch (home or "any"),
  // everyone who isn't a driver, and that branch's vehicles.
  const scope = await getBranchScope(orgId);
  const branchOptions = scope.branches.map((b) => ({ id: b.id, name: b.name }));
  const branchName = new Map(scope.branches.map((b) => [b.id, b.name]));
  const shownMembers = (members ?? []).filter((m) => m.member_role !== "driver" || scope.driverIn(m.user_id));
  const shownVehicles = (vehicles ?? []).filter((v) => scope.vehicleIn(v.id));
  const slots = scope.current ? [] : (allSlots ?? []).filter((s) => !s.claimed_by);
  const inviteBySlot = latestInviteBySlot((inviteRows ?? []) as InviteRow[]);
  const nowMs = new Date().getTime();
  const displayIdByUserId = new Map(
    (allSlots ?? []).filter((s) => s.claimed_by).map((s) => [s.claimed_by as string, s.display_id]),
  );

  // "· driver-owned" marks an owner-operator's own vehicle (2026-09-30).
  const vehicleLabel = (v: { nickname: string | null; make: string | null; model: string | null; display_id: string | null; year?: number | null; ownership?: string | null }) => {
    const name = [v.year && String(v.year), v.make, v.model].filter(Boolean).join(" ");
    const base = v.display_id ? `${name || v.nickname || "Vehicle"} (${v.display_id})` : name || v.nickname || "Vehicle";
    return v.ownership === "driver_owned" ? `${base} · driver-owned` : base;
  };
  const vehicleOptions = (vehicles ?? []).map((v) => ({
    id: v.id,
    label: vehicleLabel(v),
    assignedToDriverId: v.assigned_driver_id,
  }));
  const vehicleByDriverId = new Map(
    (vehicles ?? []).filter((v) => v.assigned_driver_id).map((v) => [v.assigned_driver_id as string, v]),
  );
  const driverNameById = new Map(
    (members ?? []).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.user_id as string, [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—"];
    }),
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
        <h1 className="mt-1 text-2xl font-semibold">
          Drivers &amp; vehicles{scope.current && <span className="text-muted"> · {scope.current.name}</span>}
        </h1>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <AddDriverForm
          orgId={orgId}
          callerRole={callerRole === "owner" || callerRole === "admin" || callerRole === "operator" ? callerRole : "operator"}
        />
        <AddVehicleForm orgId={orgId} />
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
              <th className="px-4 py-3 font-medium">Vehicle</th>
              {branchOptions.length > 0 && <th className="px-4 py-3 font-medium">Branch</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shownMembers.map((m) => {
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
                    {m.member_role === "driver" && m.is_active ? (
                      <DriverVehicleSelect
                        driverId={m.user_id}
                        currentVehicleId={vehicleByDriverId.get(m.user_id)?.id ?? null}
                        vehicles={vehicleOptions}
                      />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {branchOptions.length > 0 && (
                    <td className="px-4 py-3">
                      {m.member_role === "driver" ? (
                        <MemberBranchSelect
                          userId={m.user_id}
                          current={m.any_branch ? "any" : (m.branch_id ?? "")}
                          branches={branchOptions}
                        />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
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
            {slots.map((s) => {
              const invite = describeInvite(inviteBySlot.get(s.id), nowMs);
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{[s.first_name, s.last_name].join(" ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.display_id}</td>
                  <td className="px-4 py-3 text-muted">{invite?.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted">{invite?.role ?? "driver"}</td>
                  <td className="px-4 py-3 text-muted">—</td>
                  {branchOptions.length > 0 && <td className="px-4 py-3 text-muted">—</td>}
                  <td className="px-4 py-3">
                    <InviteStatusPill invite={invite} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActionsMenu>
                      {invite && <ResendInviteButton inviteId={invite.inviteId} />}
                      <RemoveSlotButton
                        slotId={s.id}
                        label={invite ? "Cancel invitation" : "Remove"}
                        busyLabel={invite ? "Cancelling…" : "Removing…"}
                      />
                    </RowActionsMenu>
                  </td>
                </tr>
              );
            })}
            {shownMembers.length === 0 && slots.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No drivers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Vehicles</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Plate</th>
                <th className="px-4 py-3 font-medium">Driver</th>
                {branchOptions.length > 0 && <th className="px-4 py-3 font-medium">Branch</th>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shownVehicles.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{v.display_id}</td>
                  <td className="px-4 py-3">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                    {v.nickname ? ` "${v.nickname}"` : ""}
                    {v.ownership === "driver_owned" && (
                      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                        driver-owned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{v.plate ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {v.assigned_driver_id ? driverNameById.get(v.assigned_driver_id) ?? "—" : "Unassigned"}
                  </td>
                  {branchOptions.length > 0 && (
                    <td className="px-4 py-3">
                      <VehicleBranchSelect vehicleId={v.id} current={v.branch_id} branches={branchOptions} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    {!v.assigned_driver_id && <ArchiveButton vehicleId={v.id} />}
                  </td>
                </tr>
              ))}
              {shownVehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    {scope.current ? `No vehicles in ${scope.current.name} yet.` : "No vehicles yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {branchOptions.length > 0 && scope.current === null && (
          <p className="mt-2 text-xs text-muted">
            {branchName.size} branch{branchName.size === 1 ? "" : "es"}. Pick one in the sidebar to see only its
            drivers and vehicles.
          </p>
        )}
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

// A driver row that has not joined yet: an email invitation that is live
// ("Invited", with the days left), one whose link expired, or a code-only
// driver who has not linked their account.
function InviteStatusPill({ invite }: { invite: ReturnType<typeof describeInvite> }) {
  if (!invite) {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
        Unclaimed
      </span>
    );
  }
  if (invite.kind === "expired") {
    return (
      <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">
        Invite expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
        Invited
      </span>
      <span className="text-xs text-muted">
        {invite.daysLeft === 1 ? "expires in 1 day" : `expires in ${invite.daysLeft} days`}
      </span>
    </span>
  );
}
