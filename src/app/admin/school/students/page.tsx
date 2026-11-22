// School transportation (2026-10-09): schools (campuses the routes serve)
// and the student roster. Only what a route needs is kept: first name, last
// initial, grade and school -- no home address, no birthdate (student data
// is protected by FERPA and state laws; collect the minimum).

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { addStudent, deactivateStudent, updateStudent } from "../actions";
import { StudentFields } from "../student-fields";
import { ActionForm, RowButton } from "../form-kit";
import { InviteParentSheet } from "../invite-parent";
import { resendParentInvite, revokeParent, unlinkParentStudent } from "../guardian-actions";
import { requireFeature } from "@/lib/fleet-features";
import { PageHeader } from "@/components/page-ui";
import { loadNeedCatalog, loadStudentNeeds } from "@/lib/school-needs";
import { NeedChips } from "../need-chips";
import { Sheet } from "@/components/sheet";

export default async function StudentsAndParentsPage() {
  await requireFeature("school");
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: schools }, { data: students }, { data: assignments }, { data: guardians }, { data: guardianLinks }, { data: pendingInvites }] = await Promise.all([
    supabase.from("bus_sites").select("id, name, address").eq("organization_id", orgId).order("name"),
    supabase
      .from("bus_students")
      .select(
        "id, first_name, last_initial, grade, external_id, school_site_id, home_address, home_latitude, home_longitude, parent1_name, parent1_phone, parent2_name, parent2_phone, program_need_id, transport_note",
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("first_name"),
    supabase.from("bus_stop_assignments").select("student_id").eq("organization_id", orgId),
    supabase
      .from("bus_guardians")
      .select("id, first_name, last_name, email, display_id, user_id, claimed_at, is_active, revoked_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("bus_student_guardians").select("guardian_id, student_id").eq("organization_id", orgId).eq("is_active", true),
    supabase
      .from("bus_guardian_invites")
      .select("guardian_id, expires_at")
      .eq("organization_id", orgId)
      .eq("status", "pending"),
  ]);
  const catalog = await loadNeedCatalog(supabase, orgId);
  const needsByStudent = await loadStudentNeeds(supabase, orgId, catalog, students ?? []);
  const studentLabel = new Map((students ?? []).map((s) => [s.id, `${s.first_name}${s.last_initial ? ` ${s.last_initial}.` : ""}`]));
  const linksByGuardian = new Map<string, string[]>();
  for (const l of guardianLinks ?? []) {
    if (!studentLabel.has(l.student_id)) continue;
    linksByGuardian.set(l.guardian_id, [...(linksByGuardian.get(l.guardian_id) ?? []), l.student_id]);
  }
  const pendingByGuardian = new Map((pendingInvites ?? []).map((i) => [i.guardian_id, i.expires_at as string]));
  const parentStatus = (g: { is_active: boolean; user_id: string | null; claimed_at: string | null; id: string }) => {
    if (!g.is_active) return { label: "Revoked", cls: "bg-danger/10 text-danger" };
    if (g.user_id || g.claimed_at) return { label: "Has access", cls: "bg-success/15 text-success" };
    const exp = pendingByGuardian.get(g.id);
    if (exp && new Date(exp) > new Date()) return { label: "Invited", cls: "bg-accent/15 text-accent" };
    return { label: "Invitation expired", cls: "bg-warning/15 text-warning" };
  };
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const routedCount = new Map<string, number>();
  for (const a of assignments ?? []) routedCount.set(a.student_id, (routedCount.get(a.student_id) ?? 0) + 1);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <PageHeader
        title="Students &amp; parents"
        description="Each student has a school, a home address (their pick-up stop) and up to two parents or guardians to call in an emergency. Only admins and operators see this; drivers see first name, last initial and grade. Student records are protected by FERPA and state privacy laws."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InviteParentSheet
              students={(students ?? []).map((s) => ({
                id: s.id,
                name: `${s.first_name}${s.last_initial ? ` ${s.last_initial}.` : ""}`,
                grade: s.grade,
              }))}
            />
            <Sheet label="Add student" title="Add a student">
              <ActionForm action={addStudent} submitLabel="Add student">
                <StudentFields schools={(schools ?? []).map((x) => ({ id: x.id, name: x.name }))} catalog={catalog} />
              </ActionForm>
            </Sheet>
          </div>
        }
      />
      <section className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Transport needs</th>
                  <th className="px-4 py-3 font-medium">Emergency contacts</th>
                  <th className="px-4 py-3 font-medium">Home</th>
                  <th className="px-4 py-3 font-medium">On routes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(students ?? []).map((st) => (
                  <tr key={st.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {st.first_name} {st.last_initial ? `${st.last_initial}.` : ""}
                      <span className="block text-xs font-normal text-muted">
                        {st.grade ? `Grade ${st.grade}` : "—"}
                        {st.external_id ? ` · #${st.external_id}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{st.school_site_id ? schoolName.get(st.school_site_id) : "—"}</td>
                    <td className="px-4 py-3">
                      <NeedChips v={needsByStudent.get(st.id)} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {[
                        [st.parent1_name, st.parent1_phone],
                        [st.parent2_name, st.parent2_phone],
                      ]
                        .filter(([n, p]) => n || p)
                        .map(([n, p], i) => (
                          <span key={i} className="block">
                            {n ?? "Parent"}
                            {p && (
                              <a href={`tel:${p}`} className="ml-2 text-accent hover:underline">
                                {p}
                              </a>
                            )}
                          </span>
                        ))}
                      {!st.parent1_phone && !st.parent2_phone && !st.parent1_name && !st.parent2_name && "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {st.home_address ? (
                        <>
                          <span className="block max-w-[220px] truncate" title={st.home_address}>
                            {st.home_address}
                          </span>
                          <span className={`text-xs ${st.home_latitude != null ? "text-success" : "text-amber-600"}`}>
                            {st.home_latitude != null ? "✓ located" : "not located, re-pick it"}
                          </span>
                        </>
                      ) : (
                        "No address"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {routedCount.get(st.id) ? `${routedCount.get(st.id)} stop(s)` : "Not assigned"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Sheet label="Edit" title={`Edit ${st.first_name}`} variant="secondary">
                        <ActionForm action={updateStudent} submitLabel="Save student">
                          <StudentFields
                            schools={(schools ?? []).map((x) => ({ id: x.id, name: x.name }))}
                            catalog={catalog}
                            v={{ ...st, need_ids: (needsByStudent.get(st.id)?.needs ?? []).map((n) => n.id) }}
                          />
                        </ActionForm>
                      </Sheet>
                      <RowButton
                        onRun={deactivateStudent.bind(null, st.id)}
                        label="Remove"
                        danger
                        confirmText={`Remove ${st.first_name} from the roster? Past ridership is kept.`}
                      />
                    </td>
                  </tr>
                ))}
                {(students ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted">
                      No students yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </section>

      <section className="mt-10 space-y-3">
        <div>
          <h2 className="text-base font-semibold">Parents with app access</h2>
          <p className="text-sm text-muted">
            Parents you invited to the CM Fleet app. They follow the bus for their students and tell the school when a student
            won&apos;t ride. Only an owner or an admin can invite or revoke.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Parent ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(guardians ?? []).map((g) => {
                const st = parentStatus(g);
                const ids = linksByGuardian.get(g.id) ?? [];
                return (
                  <tr key={g.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {g.first_name} {g.last_name}
                      <span className="block text-xs font-normal text-muted">{g.email}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {ids.length === 0 ? (
                        "—"
                      ) : (
                        ids.map((sid) => (
                          <span key={sid} className="mr-2 inline-flex items-center">
                            {studentLabel.get(sid)}
                            {g.is_active && (
                              <RowButton
                                onRun={unlinkParentStudent.bind(null, g.id, sid)}
                                label="✕"
                                danger
                                confirmText={`Stop ${g.first_name} from following ${studentLabel.get(sid)}?`}
                              />
                            )}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{g.display_id}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {g.is_active && !g.user_id && !g.claimed_at && (
                        <RowButton onRun={resendParentInvite.bind(null, g.id)} label="Resend" />
                      )}
                      {g.is_active && (
                        <RowButton
                          onRun={revokeParent.bind(null, g.id)}
                          label="Revoke"
                          danger
                          confirmText={`Remove ${g.first_name} ${g.last_name}'s access? They will no longer see the bus.`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {(guardians ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No parents invited yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
