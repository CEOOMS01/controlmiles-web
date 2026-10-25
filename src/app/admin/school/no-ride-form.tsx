"use client";

// "Not riding the bus" notice recorded by the office (2026-10-25): a parent
// called to say the student has a medical appointment, overslept and a parent
// is driving them, is sick... The student then shows as "Notified" instead of
// "Absent", with no alert, and stays out of the attendance rate. The parent's
// own notice, from the Fleet app, writes the same row.

import { Sheet } from "@/components/sheet";
import { ActionForm, RowButton, inputClass } from "./form-kit";
import { recordNoRide, undoNoRide } from "./actions";
import { NOTICE_REASON_LABEL } from "@/lib/school-status";

export function NoRideSheet({
  studentId,
  studentName,
  date,
  routeType,
}: {
  studentId: string;
  studentName: string;
  date: string;
  routeType: string;
}) {
  return (
    <Sheet
      label="Parent called? Mark not riding"
      title={`Not riding the bus: ${studentName}`}
      description={`For ${date}. The student will show as notified, not absent.`}
      variant="secondary"
    >
      <ActionForm action={recordNoRide} submitLabel="Save notice">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="date" value={date} />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Reason</label>
          <select name="reason" defaultValue="" required className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {Object.entries(NOTICE_REASON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Which bus</label>
          <select name="part" defaultValue={routeType === "school_pm" ? "pm" : "am"} className={inputClass}>
            <option value="am">Morning bus</option>
            <option value="pm">Afternoon bus</option>
            <option value="both">Both</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="will_attend" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />A parent is taking them to
          school
        </label>
        <div className="sm:col-span-3">
          <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
          <input name="note" maxLength={300} placeholder="Dentist at 8:30, mother will drop them at school" className={inputClass} />
        </div>
      </ActionForm>
    </Sheet>
  );
}

export function UndoNoRide({ studentId, date }: { studentId: string; date: string }) {
  return (
    <RowButton
      onRun={undoNoRide.bind(null, studentId, date)}
      label="Undo notice"
      confirmText="Remove this notice? The student will count as absent if they don't ride."
    />
  );
}
