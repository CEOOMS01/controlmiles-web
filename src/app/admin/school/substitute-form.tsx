"use client";

// "Substitute for today" (plan section 8): swap the driver, bus and/or
// monitor of a route for one date only, so the route starts on time when
// someone is late or out. Empty fields keep the regular crew.

import { useState } from "react";
import { clearSubstitute, setSubstitute } from "./actions";
import { ActionForm, RowButton, inputClass } from "./form-kit";
import type { CrewOption, CrewOverride } from "@/lib/school-crew";
import { MonitorPicker } from "./monitor-picker";

export function SubstituteForm({
  routeId,
  date,
  drivers,
  monitors,
  vehicles,
  current,
  startOpen = false,
}: {
  routeId: string;
  date: string;
  drivers: CrewOption[];
  monitors: CrewOption[];
  vehicles: CrewOption[];
  current: CrewOverride | null;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div id="substitute" className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent"
        >
          {current ? "Change today's substitute" : "Assign a substitute for today"}
        </button>
        {current && (
          <RowButton
            onRun={clearSubstitute.bind(null, routeId, date)}
            label="Back to the regular crew"
            confirmText="Remove today's substitute and use the regular crew?"
          />
        )}
      </div>
      {open && (
        <ActionForm action={setSubstitute} submitLabel="Save substitute for today">
          <input type="hidden" name="route_id" value={routeId} />
          <input type="hidden" name="service_date" value={date} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Substitute driver</label>
            <select name="driver_id" defaultValue={current?.driver_id ?? ""} className={inputClass}>
              <option value="">Keep the regular driver</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Substitute bus</label>
            <select name="vehicle_id" defaultValue={current?.vehicle_id ?? ""} className={inputClass}>
              <option value="">Keep the regular bus</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <MonitorPicker
            monitors={monitors}
            defaultId={current?.monitor_id}
            defaultName={current?.monitor_name}
            label="Substitute monitor"
            emptyLabel="Keep the regular monitor"
            namePlaceholder="Or a substitute's name (no app)"
          />
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-sm font-medium">Reason (optional)</label>
            <input
              name="reason"
              defaultValue={current?.reason ?? ""}
              maxLength={200}
              placeholder="Driver running late, called out sick, bus in the shop…"
              className={inputClass}
            />
          </div>
        </ActionForm>
      )}
    </div>
  );
}
