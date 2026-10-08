"use client";

import { TimeInput } from "@/components/time-input";
import { WEEKDAYS } from "@/lib/school";
import { createSchoolRoute } from "../actions";
import { ActionForm, inputClass } from "../form-kit";

type Option = { id: string; label: string };

export function CreateSchoolRouteForm({
  schools,
  drivers,
  vehicles,
  timeFormat,
}: {
  schools: Option[];
  drivers: Option[];
  vehicles: Option[];
  timeFormat: "12h" | "24h";
}) {
  return (
    <ActionForm action={createSchoolRoute} submitLabel="Create school route">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Route name</label>
        <input name="name" required placeholder="Route 12 — Lincoln AM" className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Run</label>
        <select name="route_type" defaultValue="school_am" className={inputClass}>
          <option value="school_am">AM — pick up, then to school</option>
          <option value="school_pm">PM — from school, then home</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">School</label>
        <select name="school_site_id" defaultValue="" className={inputClass}>
          <option value="">—</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Driver</label>
        <select name="driver_id" defaultValue="" className={inputClass}>
          <option value="">Unassigned</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Bus / vehicle</label>
        <select name="vehicle_id" defaultValue="" className={inputClass}>
          <option value="">Unassigned</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Bus monitor (optional)</label>
        <input name="monitor_name" maxLength={80} placeholder="Aide's name" className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Start time</label>
        <TimeInput name="scheduled_start_time" format={timeFormat} />
      </div>
      <fieldset className="sm:col-span-3">
        <legend className="mb-1.5 block text-sm font-medium">Service days</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {WEEKDAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-1.5">
              <input type="checkbox" name="service_days" value={d.n} defaultChecked={d.n <= 5} />
              {d.short}
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
