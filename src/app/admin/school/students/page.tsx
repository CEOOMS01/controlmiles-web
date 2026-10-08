// School transportation (2026-10-09): schools (campuses the routes serve)
// and the student roster. Only what a route needs is kept: first name, last
// initial, grade and school -- no home address, no birthdate (student data
// is protected by FERPA and state laws; collect the minimum).

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { AddressAutocompleteInput } from "../../routes/address-autocomplete-input";
import { addSchool, addStudent, deactivateStudent, deleteSchool } from "../actions";
import { ActionForm, RowButton, inputClass } from "../form-kit";

export default async function SchoolsAndStudentsPage() {
  const supabase = await createClient();
  const { profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const [{ data: schools }, { data: students }, { data: assignments }] = await Promise.all([
    supabase.from("school_sites").select("id, name, address").eq("organization_id", orgId).order("name"),
    supabase
      .from("students")
      .select("id, first_name, last_initial, grade, external_id, school_site_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("first_name"),
    supabase.from("student_stop_assignments").select("student_id").eq("organization_id", orgId),
  ]);
  const schoolName = new Map((schools ?? []).map((s) => [s.id, s.name]));
  const routedCount = new Map<string, number>();
  for (const a of assignments ?? []) routedCount.set(a.student_id, (routedCount.get(a.student_id) ?? 0) + 1);

  return (
    <main className="space-y-10 px-6 py-10 sm:px-10">
      <div>
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">School transportation</p>
        <h1 className="mt-1 text-2xl font-semibold">Schools &amp; students</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Keep only what drivers need on a route: first name, last initial, grade and school. Student
          records are protected by FERPA and state privacy laws.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Schools ({schools?.length ?? 0})</h2>
        <ActionForm action={addSchool} submitLabel="Add school">
          <div>
            <label className="mb-1.5 block text-sm font-medium">School name</label>
            <input name="name" required placeholder="Lincoln Elementary" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <AddressAutocompleteInput
              name="address"
              label="Address"
              placeholder="Start typing the school's address"
              latName="latitude"
              lonName="longitude"
            />
          </div>
        </ActionForm>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <tbody>
              {(schools ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.address ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <RowButton
                      onRun={deleteSchool.bind(null, s.id)}
                      label="Remove"
                      danger
                      confirmText={`Remove ${s.name}? Routes and students keep working without it.`}
                    />
                  </td>
                </tr>
              ))}
              {(schools ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted">No schools yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Students ({students?.length ?? 0})</h2>
        <ActionForm action={addStudent} submitLabel="Add student">
          <div>
            <label className="mb-1.5 block text-sm font-medium">First name</label>
            <input name="first_name" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Last initial</label>
            <input name="last_initial" maxLength={1} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Grade</label>
            <input name="grade" placeholder="3" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">School</label>
            <select name="school_site_id" defaultValue="" className={inputClass}>
              <option value="">—</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">District student ID (optional)</label>
            <input name="external_id" className={inputClass} />
          </div>
        </ActionForm>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">On routes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(students ?? []).map((st) => (
                <tr key={st.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {st.first_name} {st.last_initial ? `${st.last_initial}.` : ""}
                    {st.external_id && <span className="ml-2 text-xs text-muted">#{st.external_id}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{st.grade ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{st.school_site_id ? schoolName.get(st.school_site_id) : "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {routedCount.get(st.id) ? `${routedCount.get(st.id)} stop(s)` : "Not assigned"}
                  </td>
                  <td className="px-4 py-3 text-right">
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
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
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
