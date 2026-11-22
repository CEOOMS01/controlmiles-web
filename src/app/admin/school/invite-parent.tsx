"use client";

// Invite a parent to the Fleet app (2026-11-21). The parent gets an email with a
// link and a parent ID; they choose their own password when they accept. Only an
// owner or an admin can do it (the database checks).

import { Sheet } from "@/components/sheet";
import { ActionForm, inputClass } from "./form-kit";
import { inviteParent } from "./guardian-actions";

export function InviteParentSheet({ students }: { students: { id: string; name: string; grade: string | null }[] }) {
  return (
    <Sheet
      label="Invite parent"
      title="Invite a parent"
      description="They get an email with a link to the CM Fleet app and their parent ID. They see the bus for the students you choose and can tell the school when a student won't ride."
    >
      <ActionForm action={inviteParent} submitLabel="Send invitation">
        <div>
          <label className="mb-1.5 block text-sm font-medium">First name</label>
          <input name="first_name" required maxLength={80} autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Last name</label>
          <input name="last_name" required maxLength={80} autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <input name="email" type="email" required maxLength={200} autoComplete="off" className={inputClass} />
        </div>
        <fieldset className="sm:col-span-3">
          <legend className="mb-1.5 text-sm font-medium">Their students</legend>
          {students.length === 0 ? (
            <p className="text-sm text-muted">Add students first.</p>
          ) : (
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="student_ids" value={s.id} className="h-4 w-4 accent-[var(--accent)]" />
                  <span>
                    {s.name}
                    {s.grade ? <span className="text-muted"> · grade {s.grade}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </ActionForm>
    </Sheet>
  );
}
