// Bus monitor picker (2026-10-09): a monitor member who uses the app
// (invited on Team as "Bus monitor") or, for monitors without the app, just a
// name. Picking a member clears the name on save.

import type { CrewOption } from "@/lib/school-crew";
import { inputClass } from "./form-kit";

export function MonitorPicker({
  monitors,
  defaultId,
  defaultName,
  emptyLabel = "No monitor",
  namePlaceholder = "Name, if they don't use the app",
  label = "Bus monitor",
}: {
  monitors: CrewOption[];
  defaultId?: string | null;
  defaultName?: string | null;
  emptyLabel?: string;
  namePlaceholder?: string;
  label?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <select name="monitor_id" defaultValue={defaultId ?? ""} className={inputClass}>
        <option value="">{monitors.length ? `${emptyLabel} / by name below` : emptyLabel}</option>
        {monitors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} (app)
          </option>
        ))}
      </select>
      <input
        name="monitor_name"
        defaultValue={defaultName ?? ""}
        maxLength={80}
        placeholder={namePlaceholder}
        className={`${inputClass} mt-2`}
      />
    </div>
  );
}
