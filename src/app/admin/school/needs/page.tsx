// School bus, transport need codes (2026-11-21): the school's own catalog of short codes that a driver and an aide
// read on the route (City Schools writes MA2, SV, WA, NV...). Each school edits its own; the Baltimore City model,
// from the City Schools "School Route Codes" training sheet, can be loaded in one click. Codes describe what the
// student needs on the bus, never a diagnosis.

import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { requireFeature } from "@/lib/fleet-features";
import { loadNeedCatalog, GROUP_CHIP, NEED_GROUPS } from "@/lib/school-needs";
import { PageHeader } from "@/components/page-ui";
import { Sheet } from "@/components/sheet";
import { ActionForm, RowButton, inputClass } from "../form-kit";
import { RoutesMenu } from "../routes-menu";
import { addNeedCode, deleteNeedCode, loadBaltimoreCodes, setNeedCodeActive, updateNeedCode } from "../needs-actions";

export default async function NeedCodesPage() {
  await requireFeature("school");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;
  const catalog = await loadNeedCatalog(supabase, orgId);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <RoutesMenu active="needs" />
      <PageHeader
        title="Needs codes"
        description="The short codes drivers and aides see on a route for each student: help to board, a vest, a wheelchair, an aide, how the student communicates. They say what the student needs on the bus, never a diagnosis. Each school edits its own list."
        actions={
          <Sheet label="Add code" title="Add a code">
            <ActionForm action={addNeedCode} submitLabel="Add code">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Group</label>
                <select name="grp" defaultValue="mobility" className={inputClass}>
                  {NEED_GROUPS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Code</label>
                <input name="code" required maxLength={8} placeholder="MA10" className={`${inputClass} uppercase`} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">What it means</label>
                <input name="label" required maxLength={80} placeholder="Needs a booster seat" className={inputClass} />
              </div>
            </ActionForm>
          </Sheet>
        }
      />

      {catalog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted">This school has no codes yet.</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
            Start from the Baltimore City model (36 codes: program, equipment and staff, communication and mobility
            assistance, from the City Schools route-codes sheet) and change what you need, or add your own.
          </p>
          <div className="mt-4 flex justify-center">
            <RowButton onRun={loadBaltimoreCodes} label="Load the Baltimore City codes" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {NEED_GROUPS.map((g) => {
            const rows = catalog.filter((c) => c.grp === g.key);
            return (
              <section key={g.key} className="overflow-hidden overflow-x-auto rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">{g.label}</h2>
                  <p className="text-xs text-muted">{g.hint}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id} className={`border-b border-border last:border-0 ${c.is_active ? "" : "opacity-50"}`}>
                        <td className="w-24 px-4 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${GROUP_CHIP[c.grp]}`}>{c.code}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {c.label}
                          {!c.is_active && <span className="ml-2 text-xs text-muted">off</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <Sheet label="Edit" title={`Edit ${c.code}`} variant="secondary">
                            <ActionForm action={updateNeedCode} submitLabel="Save">
                              <input type="hidden" name="id" value={c.id} />
                              <div className="sm:col-span-3">
                                <label className="mb-1.5 block text-sm font-medium">What {c.code} means</label>
                                <input name="label" required maxLength={80} defaultValue={c.label} className={inputClass} />
                              </div>
                            </ActionForm>
                          </Sheet>
                          <RowButton
                            onRun={setNeedCodeActive.bind(null, c.id, !c.is_active)}
                            label={c.is_active ? "Turn off" : "Turn on"}
                          />
                          <RowButton
                            onRun={deleteNeedCode.bind(null, c.id)}
                            label="Delete"
                            danger
                            confirmText={`Delete ${c.code}? Students that have it lose it. To keep their history, turn it off instead.`}
                          />
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td className="px-4 py-3 text-muted">No codes in this group.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
