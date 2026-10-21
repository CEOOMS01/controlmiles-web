// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/settings/branch-admins.tsx
//
// Branches under the owner (2026-10-20): who runs each branch (the owner
// assigns an admin) and the history of moves between branches, each with
// the reason the owner or an admin wrote.

import { createClient } from "@/lib/supabase/server";
import { BranchAdminSelect } from "./branch-admin-select";

type Move = {
  id: string;
  subject_type: "member" | "student";
  subject_name: string | null;
  from_branch_id: string | null;
  to_branch_id: string | null;
  from_any: boolean;
  to_any: boolean;
  note: string;
  moved_by: string | null;
  moved_at: string;
};

export async function BranchAdmins({ orgId, isOwner }: { orgId: string; isOwner: boolean }) {
  const supabase = await createClient();
  const [{ data: branches }, { data: members }, { data: moves }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, manager_id")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("organization_members")
      .select("user_id, member_role, profiles(first_name, last_name, email)")
      .eq("organization_id", orgId)
      .eq("is_active", true),
    supabase
      .from("branch_moves")
      .select("id, subject_type, subject_name, from_branch_id, to_branch_id, from_any, to_any, note, moved_by, moved_at")
      .eq("organization_id", orgId)
      .order("moved_at", { ascending: false })
      .limit(30),
  ]);
  if (!branches || branches.length === 0) return null;

  const people = new Map(
    (members ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as
        | { first_name: string | null; last_name: string | null; email: string | null }
        | null;
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "Member";
      return [m.user_id as string, { name, role: m.member_role as string }];
    }),
  );
  const admins = [...people.entries()]
    .filter(([, v]) => v.role === "admin" || v.role === "owner")
    .map(([id, v]) => ({ id, name: v.role === "owner" ? `${v.name} (owner)` : v.name }));
  const branchName = new Map(branches.map((b) => [b.id as string, b.name as string]));
  const where = (id: string | null, any: boolean) => (any ? "Any branch" : id ? (branchName.get(id) ?? "Removed branch") : "No branch");

  return (
    <div className="mt-8 space-y-8">
      <div>
        <p className="text-sm font-medium">Who runs each branch</p>
        <p className="mt-0.5 text-xs text-muted">
          {isOwner
            ? "Pick the admin in charge of each location. Admins and you can move instructors and students between branches, with a reason."
            : "Set by the owner. You can move instructors and students between branches, with a reason."}
        </p>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-background">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{b.name}</span>
              {isOwner ? (
                <BranchAdminSelect branchId={b.id} current={(b.manager_id as string | null) ?? ""} admins={admins} />
              ) : (
                <span className="text-muted">{b.manager_id ? (people.get(b.manager_id)?.name ?? "Admin") : "No admin yet"}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium">Moves between branches</p>
        <p className="mt-0.5 text-xs text-muted">The last 30, newest first, with the reason given.</p>
        {(moves ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted">No moves yet. Use Move on the Team page or on a student.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-background text-sm">
            {((moves ?? []) as Move[]).map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p>
                  <span className="font-medium">{m.subject_name ?? (m.subject_type === "student" ? "Student" : "Instructor")}</span>
                  <span className="text-muted"> · {m.subject_type === "student" ? "student" : "instructor"}</span>
                  {": "}
                  {where(m.from_branch_id, m.from_any)} → {where(m.to_branch_id, m.to_any)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  “{m.note}” · {m.moved_by ? (people.get(m.moved_by)?.name ?? "Admin") : "Admin"} ·{" "}
                  {new Date(m.moved_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
