"use client";

// The student form fields, shared by Add and Edit: the student, their school,
// the home address (it becomes a pick-up stop on a route) and two parents or
// guardians to call in an emergency (the second is optional).

import { AddressAutocompleteInput } from "../routes/address-autocomplete-input";
import { inputClass } from "./form-kit";
import { GROUP_CHIP, NEED_GROUPS, type NeedCode } from "@/lib/school-needs";

export type StudentValues = {
  id?: string;
  first_name?: string;
  last_initial?: string | null;
  grade?: string | null;
  school_site_id?: string | null;
  external_id?: string | null;
  home_address?: string | null;
  home_latitude?: number | null;
  home_longitude?: number | null;
  parent1_name?: string | null;
  parent1_phone?: string | null;
  parent2_name?: string | null;
  parent2_phone?: string | null;
  /** Transport needs (school bus): the codes the student has, their program and a short note. */
  need_ids?: string[];
  program_need_id?: string | null;
  transport_note?: string | null;
};

const label = "mb-1.5 block text-sm font-medium";

export function StudentFields({
  schools,
  v = {},
  catalog = [],
}: {
  schools: { id: string; name: string }[];
  v?: StudentValues;
  catalog?: NeedCode[];
}) {
  const have = new Set(v.need_ids ?? []);
  // A code that was turned off is still shown while the student has it, so saving does not drop it.
  const offered = catalog.filter((c) => c.is_active || have.has(c.id));
  const programs = offered.filter((c) => c.grp === "program");
  return (
    <>
      {v.id && <input type="hidden" name="student_id" value={v.id} />}
      <div>
        <label className={label}>First name</label>
        <input name="first_name" required defaultValue={v.first_name ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={label}>Last initial</label>
        <input name="last_initial" maxLength={1} defaultValue={v.last_initial ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={label}>Grade</label>
        <input name="grade" placeholder="3" defaultValue={v.grade ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={label}>School</label>
        <select name="school_site_id" defaultValue={v.school_site_id ?? ""} className={inputClass}>
          <option value="">—</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>District student ID (optional)</label>
        <input name="external_id" defaultValue={v.external_id ?? ""} className={inputClass} />
      </div>
      <div className="sm:col-span-3">
        <AddressAutocompleteInput
          name="home_address"
          label="Home address (pick-up stop)"
          placeholder="e.g. 3608 Chestnut Ave"
          kind="personal"
          structured
          latName="home_latitude"
          lonName="home_longitude"
          defaultValue={v.home_address}
          defaultCoords={v.home_latitude != null && v.home_longitude != null ? { lat: v.home_latitude, lon: v.home_longitude } : null}
        />
      </div>
      <fieldset className="min-w-0 sm:col-span-3">
        <legend className="mb-1.5 text-sm font-medium">Transport needs</legend>
        <p className="mb-2 text-xs text-muted">
          What the driver and the aide need to know on the bus. Codes only, never a diagnosis. Edit the list in Needs codes.
        </p>
        {offered.length === 0 ? (
          <p className="text-sm text-muted">No codes yet: load them in Needs codes.</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-3">
            {NEED_GROUPS.filter((g) => g.key !== "program").map((g) => {
              const rows = offered.filter((c) => c.grp === g.key);
              if (rows.length === 0) return null;
              return (
                <div key={g.key}>
                  <p className="mb-1 text-xs font-medium text-muted">{g.label}</p>
                  <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((c) => (
                      <label key={c.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="need_ids"
                          value={c.id}
                          defaultChecked={have.has(c.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                        />
                        <span>
                          <span className={`mr-1.5 rounded px-1 py-px text-[11px] font-semibold ${GROUP_CHIP[c.grp]}`}>{c.code}</span>
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={label}>Program</label>
                <select name="program_need_id" defaultValue={v.program_need_id ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {programs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Note for the driver (optional)</label>
                <input
                  name="transport_note"
                  maxLength={200}
                  placeholder="Seat belt Y, sits in the front row"
                  defaultValue={v.transport_note ?? ""}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}
      </fieldset>
      <fieldset className="min-w-0 sm:col-span-3">
        <legend className="mb-1.5 text-sm font-medium">Emergency contacts</legend>
        <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Parent or guardian 1</label>
          <input name="parent1_name" maxLength={120} placeholder="Name" defaultValue={v.parent1_name ?? ""} className={inputClass} />
          <input type="tel" name="parent1_phone" maxLength={30} placeholder="Phone" defaultValue={v.parent1_phone ?? ""} className={`${inputClass} mt-2`} />
        </div>
        <div>
          <label className={label}>Parent or guardian 2 (optional)</label>
          <input name="parent2_name" maxLength={120} placeholder="Name" defaultValue={v.parent2_name ?? ""} className={inputClass} />
          <input type="tel" name="parent2_phone" maxLength={30} placeholder="Phone" defaultValue={v.parent2_phone ?? ""} className={`${inputClass} mt-2`} />
        </div>
        </div>
      </fieldset>
    </>
  );
}
