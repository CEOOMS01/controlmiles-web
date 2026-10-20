// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/students/page.tsx
//
// Driving school students (2026-10-19, phase 1). Each student's progress
// comes from their finished classes' real GPS trips (ds_student_progress).

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { getBranchScope } from "@/lib/branch-scope";
import { requireFeature } from "@/lib/fleet-features";
import {
  NO_PROGRAM,
  PROGRAM_COLUMNS,
  STUDENT_COLUMNS,
  formatMinutes,
  percentOf,
  requirementMet,
  statusLabel,
  studentName,
  type Program,
  type Student,
  type StudentProgress,
} from "@/lib/driving-school";
import { StudentForm } from "./student-forms";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; q?: string | string[] }>;
}) {
  const features = await requireFeature("students");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : "current";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  await supabase.rpc("ds_ensure_default_programs", { p_org: orgId });
  const [{ data: students }, { data: progressRows }, { data: programRows }, { data: me }, scope] = await Promise.all([
    supabase.from("ds_students").select(STUDENT_COLUMNS).eq("organization_id", orgId).order("last_name"),
    supabase.rpc("ds_student_progress", { p_org: orgId }),
    supabase.from("ds_programs").select(PROGRAM_COLUMNS).eq("organization_id", orgId).order("sort").order("name"),
    supabase.from("organization_members").select("member_role").eq("organization_id", orgId).eq("user_id", user.id).maybeSingle(),
    getBranchScope(orgId),
  ]);

  const programs = (programRows ?? []) as Program[];
  const programOf = (s: Student) => programs.find((p) => p.id === s.program_id) ?? NO_PROGRAM;
  const progress = new Map(((progressRows ?? []) as StudentProgress[]).map((p) => [p.student_id, p]));
  const isAdmin = me?.member_role === "owner" || me?.member_role === "admin";
  const branchName = new Map(scope.branches.map((b) => [b.id, b.name]));

  const rows = ((students ?? []) as Student[])
    .filter((s) => !scope.current || s.branch_id === scope.current.id)
    .filter((s) =>
      statusFilter === "all"
        ? true
        : statusFilter === "current"
          ? s.status === "active" || s.status === "registered"
          : s.status === statusFilter,
    )
    .filter((s) => !q || `${s.first_name} ${s.last_name} ${s.guardian_name ?? ""}`.toLowerCase().includes(q));

  const tab = (value: string, text: string) => (
    <Link
      href={`?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === value ? "bg-accent text-accent-foreground" : "border border-border hover:border-accent"}`}
    >
      {text}
    </Link>
  );

  return (
    <main className="px-6 py-10 sm:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">Students</p>
          <h1 className="mt-1 text-2xl font-semibold">Students and their hours</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Hours come from each finished class&apos;s GPS trip, split into day and night. What each student needs
            comes from their program (teen, adult or your own).
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/students/settings" className="rounded-lg border border-border px-3 py-2 text-sm hover:border-accent">
            Settings
          </Link>
        )}
      </div>

      <div className="mb-6">
        <StudentForm
          isAdmin={isAdmin}
          branches={scope.branches.map((b) => ({ id: b.id, name: b.name }))}
          programs={programs.filter((p) => p.is_active)}
          stateRecords={features.has("state_records")}
          sms={features.has("sms_reminders")}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab("current", "Current")}
        {tab("finished", "Finished")}
        {tab("dropped", "Dropped")}
        {tab("all", "All")}
        <form method="get" className="ml-auto">
          <input type="hidden" name="status" value={statusFilter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or guardian"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No students here yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Hours</th>
                <th className="px-4 py-3 font-medium">Night</th>
                <th className="px-4 py-3 font-medium">Classes</th>
                <th className="px-4 py-3 font-medium">Next class</th>
                {features.has("student_packages") && <th className="px-4 py-3 font-medium">Hours bought</th>}
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const p = progress.get(s.id);
                const minutes = Number(p?.minutes ?? 0);
                const night = Number(p?.night_minutes ?? 0);
                const prog = programOf(s);
                const pct = percentOf(minutes, prog.required_minutes);
                const met = requirementMet({ minutes, night_minutes: night }, prog);
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/students/${s.id}`} className="font-medium hover:text-accent">
                        {studentName(s)}
                      </Link>
                      <p className="text-xs text-muted">
                        {[prog.id ? prog.name : null, s.guardian_name, s.branch_id ? branchName.get(s.branch_id) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
                          <div className={`h-full ${met ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="whitespace-nowrap">{formatMinutes(minutes)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatMinutes(night)}</td>
                    <td className="px-4 py-3">{p?.classes_done ?? 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {p?.next_class ? new Date(p.next_class).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </td>
                    {features.has("student_packages") && (
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatMinutes(p?.purchased_minutes ?? 0)}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-border px-2 py-0.5 text-xs">{met && s.status === "active" ? "Hours met" : statusLabel(s.status)}</span>
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
