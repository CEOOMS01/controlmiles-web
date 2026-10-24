"use client";

// The student form fields, shared by Add and Edit: the student, their school,
// the home address (it becomes a pick-up stop on a route) and two parents or
// guardians to call in an emergency (the second is optional).

import { AddressAutocompleteInput } from "../routes/address-autocomplete-input";
import { inputClass } from "./form-kit";

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
};

const label = "mb-1.5 block text-sm font-medium";

export function StudentFields({ schools, v = {} }: { schools: { id: string; name: string }[]; v?: StudentValues }) {
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
          placeholder="Start typing the student's home address"
          latName="home_latitude"
          lonName="home_longitude"
          defaultValue={v.home_address}
          defaultCoords={v.home_latitude != null && v.home_longitude != null ? { lat: v.home_latitude, lon: v.home_longitude } : null}
        />
      </div>
      <fieldset className="grid gap-3 sm:col-span-3 sm:grid-cols-2">
        <legend className="mb-1.5 text-sm font-medium">Emergency contacts</legend>
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
      </fieldset>
    </>
  );
}
