// School transportation (2026-10-09): schools (campuses the routes serve)
// and the student roster. Only what a route needs is kept: first name, last
// initial, grade and school -- no home address, no birthdate (student data
// is protected by FERPA and state laws; collect the minimum).

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { addStudent, deactivateStudent, updateStudent } from "../actions";
import { StudentFields } from "../student-fields";
import { ActionForm, RowButton } from "../form-kit";
import { requireFeature } from "@/lib/fleet-features";
import { PageHeader } from "@/components/page-ui";
import { Sheet } from "@/components/sheet";

export default async function StudentsAndParentsPage() {
  await requireFeature("school");
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: schools }, { data: students }, { data: assignments }] = await Promise.all([
    supabase.from("school_sites").select("id, name, address").eq("organization_id", orgId).order("name"),
    supabase
      .from("students")
      .select(
        "id, first_name, last_initial, grade, external_id, school_site_id, home_address, home_latitude, home_longitude, parent1_name, parent1_phone, parent2_name, parent2_phone",
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("first_name"),
    supabase.from("student_stop_assignments").select("student_id").eq("organization_id", orgId),
  ]);
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const routedCount = new Map<string, number>();
  for (const a of assignments ?? []) routedCount.set(a.student_id, (routedCount.get(a.student_id) ?? 0) + 1);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <PageHeader
        title="Students &amp; parents"
        description="Each student has a school, a home address (their pick-up stop) and up to two parents or guardians to call in an emergency. Only admins and operators see this; drivers see first name, last initial and grade. Student records are protected by FERPA and state privacy laws."
        actions={
          <Sheet label="Add student" title="Add a student">
              <ActionForm action={addStudent} submitLabel="Add student">
                <StudentFields schools={(schools ?? []).map((x) => ({ id: x.id, name: x.name }))} />
              </ActionForm>
          </Sheet>
        }
      />
      <section className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">School</th>
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
                          <StudentFields schools={(schools ?? []).map((x) => ({ id: x.id, name: x.name }))} v={st} />
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
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      No students yet.
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
