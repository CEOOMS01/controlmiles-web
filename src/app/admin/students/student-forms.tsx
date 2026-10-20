"use client";

// Driving school students -- client forms (2026-10-19).

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAvailability,
  addPackage,
  addSkill,
  addTimeOff,
  addStudentPackage,
  createPortalLink,
  createStudent,
  issueCertificate,
  recordPayment,
  removeAvailability,
  removeTimeOff,
  revokePortalLink,
  saveDsSettings,
  saveProgram,
  setPackageActive,
  setSkillActive,
  updateStudent,
  type ActionState,
} from "./actions";
import { STUDENT_STATUSES, WEEKDAYS, type DsSettings, type Program, type Student } from "@/lib/driving-school";

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
  programs = [],
  stateRecords = false,
  sms = false,
}: {
  student?: Student;
  privateData?: { date_of_birth: string | null; permit_number: string | null } | null;
  isAdmin: boolean;
  branches: { id: string; name: string }[];
  programs?: Program[];
  stateRecords?: boolean;
  sms?: boolean;
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

      {programs.length > 0 && (
        <div>
          <label className={label}>Program</label>
          <select name="program_id" defaultValue={student?.program_id ?? programs[0]?.id ?? ""} className={field}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Teen, adult or your own: decides the hours required and who gets notices.</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">Parent or guardian (optional, usually for teens)</p>
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

      {stateRecords && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <input type="hidden" name="has_state_records" value="1" />
          <p className="text-sm font-semibold">State certificate (optional)</p>
          <p className="mb-3 text-xs text-muted">
            The official form your state supplies (for example DL 400D, DE-964, ADEE-1317): record its number here.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="state_cert_type" placeholder="Form (e.g. DL 400D)" maxLength={40} defaultValue={student?.state_cert_type ?? ""} className={field} />
            <input name="state_cert_number" placeholder="Certificate number" maxLength={40} defaultValue={student?.state_cert_number ?? ""} className={field} />
          </div>
        </div>
      )}

      {sms && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <input type="hidden" name="has_sms" value="1" />
          <input type="hidden" name="sms_consent_was" value={student?.sms_consent_at ?? ""} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="sms_consent" defaultChecked={!!student?.sms_consent_at} className="mt-1" />
            <span>
              <span className="font-semibold">Agreed to text reminders</span>
              <span className="block text-xs text-muted">
                Only with their consent. They can reply STOP at any time.
              </span>
            </span>
          </label>
          <input
            name="sms_consent_phone"
            type="tel"
            placeholder="Mobile number for texts"
            maxLength={30}
            defaultValue={student?.sms_consent_phone ?? student?.phone ?? ""}
            className={`${field} mt-2`}
          />
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
  settings,
  showBooking,
  showReminder,
}: {
  settings: DsSettings;
  showBooking: boolean;
  showReminder: boolean;
}) {
  const [state, action, pending] = useActionState(saveDsSettings, initial);
  const hidden = (name: string, value: string | number) => <input type="hidden" name={name} value={value} />;
  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      {showBooking ? (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="booking_enabled" defaultChecked={settings.booking_enabled} className="mt-1" />
            <span>
              <span className="font-semibold">Students can book online</span>
              <span className="block text-xs text-muted">
                From their link they see your instructors&apos; free slots and book. Classes appear in Classes and in the
                instructor&apos;s app.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={label}>Minimum notice (hours)</label>
              <input name="booking_lead_hours" type="number" min="0" max="336" defaultValue={settings.booking_lead_hours} className={field} />
            </div>
            <div>
              <label className={label}>Book up to (days ahead)</label>
              <input name="booking_horizon_days" type="number" min="1" max="90" defaultValue={settings.booking_horizon_days} className={field} />
            </div>
            <div>
              <label className={label}>Upcoming classes per student</label>
              <input name="booking_max_upcoming" type="number" min="1" max="20" defaultValue={settings.booking_max_upcoming} className={field} />
            </div>
            <div>
              <label className={label}>Free cancellation until (hours before)</label>
              <input name="cancel_free_hours" type="number" min="0" max="336" defaultValue={settings.cancel_free_hours} className={field} />
            </div>
          </div>
          <div>
            <label className={label}>Cancellation policy (shown before booking)</label>
            <textarea
              name="cancellation_policy"
              rows={2}
              maxLength={1000}
              defaultValue={settings.cancellation_policy ?? ""}
              placeholder="e.g. Cancel up to 24 hours before for free. Later cancellations count as a used lesson."
              className={field}
            />
            <p className="mt-1 text-xs text-muted">
              A late cancellation counts as a used lesson; a freed slot is emailed to the program&apos;s other students.
            </p>
          </div>
        </>
      ) : (
        <>
          {hidden("booking_lead_hours", settings.booking_lead_hours)}
          {hidden("booking_horizon_days", settings.booking_horizon_days)}
          {hidden("booking_max_upcoming", settings.booking_max_upcoming)}
          {hidden("cancel_free_hours", settings.cancel_free_hours)}
          {settings.booking_enabled && hidden("booking_enabled", "on")}
          {settings.cancellation_policy && hidden("cancellation_policy", settings.cancellation_policy)}
        </>
      )}
      {showReminder ? (
        <div className="max-w-xs">
          <label className={label}>Email reminder before a class (hours)</label>
          <input name="reminder_hours" type="number" min="1" max="168" defaultValue={settings.reminder_hours} className={field} />
        </div>
      ) : (
        hidden("reminder_hours", settings.reminder_hours)
      )}
      <Feedback state={state} ok="Saved." />
      <button type="submit" disabled={pending} className={primaryBtn}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

// ---------------- programs ----------------
export function ProgramForm({ program }: { program?: Program }) {
  const [state, action, pending] = useActionState(saveProgram, initial);
  return (
    <form action={action} className="grid items-end gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-12">
      {program && <input type="hidden" name="id" value={program.id} />}
      {program && <input type="hidden" name="has_active" value="1" />}
      <div className="sm:col-span-3">
        <label className="mb-1 block text-xs text-muted">Program</label>
        <input name="name" required maxLength={60} defaultValue={program?.name ?? ""} placeholder="e.g. Teen" className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Hours required</label>
        <input name="required_hours" type="number" min="0" step="0.5" defaultValue={(program?.required_minutes ?? 0) / 60} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Of them at night</label>
        <input name="required_night_hours" type="number" min="0" step="0.5" defaultValue={(program?.required_night_minutes ?? 0) / 60} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted">Class length (min)</label>
        <input name="class_minutes" type="number" min="15" max="480" step="15" defaultValue={program?.class_minutes ?? 60} className={field} />
      </div>
      <div className="flex flex-col gap-1 text-xs sm:col-span-2">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="notify_guardian" defaultChecked={program?.notify_guardian ?? false} /> Notify guardian
        </label>
        {program && (
          <label className="flex items-center gap-1">
            <input type="checkbox" name="is_active" defaultChecked={program.is_active} /> Active
          </label>
        )}
      </div>
      <div className="sm:col-span-1">
        <button type="submit" disabled={pending} className={secondaryBtn}>
          {program ? "Save" : "Add"}
        </button>
      </div>
      {(state.error || state.success) && (
        <div className="sm:col-span-12">
          <Feedback state={state} ok="Saved." />
        </div>
      )}
    </form>
  );
}

// ---------------- availability ----------------
type Opt = { id: string; label: string };

export function AvailabilityForm({ instructors, vehicles }: { instructors: Opt[]; vehicles: Opt[] }) {
  const [state, action, pending] = useActionState(addAvailability, initial);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={label}>Instructor</label>
          <select name="instructor_id" required defaultValue="" className={field}>
            <option value="" disabled>
              Select an instructor
            </option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>From</label>
          <input name="start_time" type="time" required defaultValue="09:00" className={field} />
        </div>
        <div>
          <label className={label}>To</label>
          <input name="end_time" type="time" required defaultValue="17:00" className={field} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {WEEKDAYS.map((d, i) => (
          <label key={d} className="flex items-center gap-1">
            <input type="checkbox" name="weekday" value={i} defaultChecked={i >= 1 && i <= 5} /> {d.slice(0, 3)}
          </label>
        ))}
      </div>
      <div className="max-w-sm">
        <label className={label}>Car (optional)</label>
        <select name="vehicle_id" defaultValue="" className={field}>
          <option value="">The instructor&apos;s assigned car</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add hours
      </button>
    </form>
  );
}

export function TimeOffForm({ instructors }: { instructors: Opt[] }) {
  const [state, action, pending] = useActionState(addTimeOff, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <select name="instructor_id" required defaultValue="" className={`${field} w-48`}>
        <option value="" disabled>
          Instructor
        </option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label}
          </option>
        ))}
      </select>
      <input name="date_from" type="date" required className={`${field} w-40`} />
      <input name="date_to" type="date" className={`${field} w-40`} />
      <input name="note" placeholder="Note (optional)" maxLength={200} className={`${field} w-48`} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add days off
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RemoveButton({ id, kind }: { id: string; kind: "availability" | "time_off" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (kind === "availability" ? await removeAvailability(id) : await removeTimeOff(id)))}
      className="text-xs text-danger hover:underline disabled:opacity-60"
    >
      Remove
    </button>
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
