"use client";

// Driving school students -- client forms (2026-10-19).

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPackage,
  addSkill,
  addStudentPackage,
  createPortalLink,
  createStudent,
  issueCertificate,
  recordPayment,
  revokePortalLink,
  saveDsSettings,
  setPackageActive,
  setSkillActive,
  updateStudent,
  type ActionState,
} from "./actions";
import { STUDENT_STATUSES, type Student } from "@/lib/driving-school";

const initial: ActionState = { error: null, success: false };
const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const label = "mb-1.5 block text-sm font-medium";
const primaryBtn =
  "rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60";
const secondaryBtn =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60";

function Feedback({ state, ok }: { state: ActionState; ok?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success && ok) return <p className="text-sm text-success">{ok}</p>;
  return null;
}

// ---------------- student (create / edit) ----------------
export function StudentForm({
  student,
  privateData,
  isAdmin,
  branches,
}: {
  student?: Student;
  privateData?: { date_of_birth: string | null; permit_number: string | null } | null;
  isAdmin: boolean;
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!student);
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = student ? await updateStudent(p, fd) : await createStudent(p, fd);
    if (r.success && !student && r.value) router.push(`/admin/students/${r.value}`);
    return r;
  }, initial);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryBtn}>
        Register student
      </button>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      {student && <input type="hidden" name="id" value={student.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>First name</label>
          <input name="first_name" required maxLength={60} defaultValue={student?.first_name} className={field} />
        </div>
        <div>
          <label className={label}>Last name</label>
          <input name="last_name" required maxLength={60} defaultValue={student?.last_name} className={field} />
        </div>
        <div>
          <label className={label}>Phone (optional)</label>
          <input name="phone" type="tel" maxLength={30} defaultValue={student?.phone ?? ""} className={field} />
        </div>
        <div>
          <label className={label}>Email (optional)</label>
          <input name="email" type="email" maxLength={120} defaultValue={student?.email ?? ""} className={field} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Parent or guardian (optional)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="guardian_name" placeholder="Name" maxLength={120} defaultValue={student?.guardian_name ?? ""} className={field} />
          <input name="guardian_phone" type="tel" placeholder="Phone" maxLength={30} defaultValue={student?.guardian_phone ?? ""} className={field} />
          <input name="guardian_email" type="email" placeholder="Email" maxLength={120} defaultValue={student?.guardian_email ?? ""} className={field} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Status</label>
          <select name="status" defaultValue={student?.status ?? "active"} className={field}>
            {STUDENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {branches.length > 0 && (
          <div>
            <label className={label}>Branch</label>
            <select name="branch_id" defaultValue={student?.branch_id ?? ""} className={field}>
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <input type="hidden" name="has_private" value="1" />
          <p className="text-sm font-semibold">Admins only (optional)</p>
          <p className="mb-3 text-xs text-muted">Not shown to operators, instructors or the student portal.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Date of birth</label>
              <input name="date_of_birth" type="date" defaultValue={privateData?.date_of_birth ?? ""} className={field} />
            </div>
            <div>
              <label className={label}>Permit number</label>
              <input name="permit_number" maxLength={40} defaultValue={privateData?.permit_number ?? ""} className={field} />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className={label}>Notes (optional)</label>
        <textarea name="notes" maxLength={1000} rows={2} defaultValue={student?.notes ?? ""} className={field} />
      </div>

      <Feedback state={state} ok={student ? "Saved." : undefined} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : student ? "Save" : "Register student"}
        </button>
        {!student && (
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm text-muted">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------- packages ----------------
export function AddStudentPackageForm({
  studentId,
  packages,
}: {
  studentId: string;
  packages: { id: string; name: string; minutes: number; price_cents: number }[];
}) {
  const [state, action, pending] = useActionState(addStudentPackage, initial);
  if (packages.length === 0) {
    return <p className="text-sm text-muted">Create packages in Students → Settings first.</p>;
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="student_id" value={studentId} />
      <div>
        <label className="mb-1 block text-xs text-muted">Package</label>
        <select name="package_id" className={field}>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {(p.minutes / 60).toFixed(1)} h · ${(p.price_cents / 100).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Paid now ($)</label>
        <input name="amount_paid" type="number" min="0" step="0.01" defaultValue="0" className={`${field} w-28`} />
      </div>
      <button type="submit" disabled={pending} className={secondaryBtn}>
        {pending ? "Adding…" : "Add package"}
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RecordPaymentForm({ id, studentId }: { id: string; studentId: string }) {
  const [state, action, pending] = useActionState(recordPayment, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="student_id" value={studentId} />
      <input name="amount" type="number" min="0.01" step="0.01" placeholder="$" className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-xs" />
      <button type="submit" disabled={pending} className="rounded-lg border border-border px-2 py-1 text-xs hover:border-accent">
        Record payment
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

// ---------------- portal link ----------------
export function PortalLinkBox({ studentId, hasLink }: { studentId: string; hasLink: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createPortalLink(studentId);
      if (r.error || !r.value) return setError(r.error);
      setError(null);
      setUrl(`${window.location.origin}/student/${r.value}`);
    });
  const revoke = () =>
    start(async () => {
      const r = await revokePortalLink(studentId);
      if (r.error) return setError(r.error);
      setUrl(null);
    });

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        A private link for the student or parent: upcoming classes, hours, report cards and the certificate. No
        account needed. Creating a new link turns off the old one.
      </p>
      {url && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={url} className={`${field} flex-1 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className={secondaryBtn}
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={create} disabled={pending} className={secondaryBtn}>
          {hasLink || url ? "Create a new link" : "Create link"}
        </button>
        {(hasLink || url) && (
          <button type="button" onClick={revoke} disabled={pending} className="px-3 py-2 text-sm text-danger">
            Turn off link
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------- certificate ----------------
export function IssueCertificateButton({ studentId, canIssue }: { studentId: string; canIssue: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        disabled={!canIssue || pending}
        onClick={() =>
          start(async () => {
            const r = await issueCertificate(studentId);
            setError(r.error);
          })
        }
        className={primaryBtn}
      >
        {pending ? "Issuing…" : "Issue certificate"}
      </button>
      {!canIssue && <p className="mt-1 text-xs text-muted">Available once the required hours are met.</p>}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------- settings ----------------
export function DsSettingsForm({
  requiredHours,
  requiredNightHours,
  reminderHours,
  showReminder,
}: {
  requiredHours: number;
  requiredNightHours: number;
  reminderHours: number;
  showReminder: boolean;
}) {
  const [state, action, pending] = useActionState(saveDsSettings, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Required behind-the-wheel hours</label>
          <input name="required_hours" type="number" min="0" step="0.5" defaultValue={requiredHours} className={field} />
        </div>
        <div>
          <label className={label}>Of them, at night</label>
          <input name="required_night_hours" type="number" min="0" step="0.5" defaultValue={requiredNightHours} className={field} />
        </div>
        {showReminder ? (
          <div>
            <label className={label}>Email reminder before a class (hours)</label>
            <input name="reminder_hours" type="number" min="1" max="168" defaultValue={reminderHours} className={field} />
          </div>
        ) : (
          <input type="hidden" name="reminder_hours" value={reminderHours} />
        )}
      </div>
      <p className="text-xs text-muted">
        Hours count only from finished classes, from their real GPS trip. Night is sunset to sunrise where the class
        drove.
      </p>
      <Feedback state={state} ok="Saved." />
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function AddSkillForm() {
  const [state, action, pending] = useActionState(addSkill, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="category" placeholder="Category (e.g. Parking)" maxLength={60} className={`${field} w-48`} />
      <input name="name" placeholder="Skill" maxLength={80} className={`${field} w-56`} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add skill
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ToggleButton({ id, active, kind }: { id: string; active: boolean; kind: "skill" | "package" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (kind === "skill" ? await setSkillActive(id, !active) : await setPackageActive(id, !active)))}
      className="text-xs text-accent hover:underline disabled:opacity-60"
    >
      {active ? "Turn off" : "Turn on"}
    </button>
  );
}

export function AddPackageForm() {
  const [state, action, pending] = useActionState(addPackage, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="Name (e.g. 6-hour teen package)" maxLength={80} className={`${field} w-64`} />
      <input name="hours" type="number" min="0.5" step="0.5" placeholder="Hours" className={`${field} w-24`} />
      <input name="price" type="number" min="0" step="0.01" placeholder="Price $" className={`${field} w-28`} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add package
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
