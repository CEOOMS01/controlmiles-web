"use client";

// Driving school students -- client forms (2026-10-19).

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSheet } from "@/components/sheet";
import { GroupTitle, SettingRow, Switch, UnitInput } from "@/components/settings-ui";
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
  portal = false,
  inSheet = false,
}: {
  student?: Student;
  privateData?: { date_of_birth: string | null; permit_number: string | null } | null;
  isAdmin: boolean;
  branches: { id: string; name: string }[];
  programs?: Program[];
  stateRecords?: boolean;
  sms?: boolean;
  // The student and parent link only exists on plans with student_portal.
  portal?: boolean;
  // In the page header's slide-over panel (2026-10-20 redesign).
  inSheet?: boolean;
}) {
  const router = useRouter();
  const sheet = useSheet();
  const [open, setOpen] = useState(!!student || inSheet);
  // Parent or guardian only for programs that have one (teens); an adult
  // program doesn't ask for it (user rule, 2026-10-20).
  const [programId, setProgramId] = useState(student?.program_id ?? programs[0]?.id ?? "");
  const selectedProgram = programs.find((p) => p.id === programId);
  const askGuardian = programs.length === 0 || (selectedProgram?.notify_guardian ?? true);
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
    <form action={action} className={`space-y-4 ${inSheet ? "" : "rounded-xl border border-border bg-surface p-5"}`}>
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
          <select name="program_id" value={programId} onChange={(e) => setProgramId(e.target.value)} className={field}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">Decides the hours required and whether a parent or guardian is asked for.</p>
        </div>
      )}

      {/* Lesson language preference (2026-10-20). Online booking only offers
          times with an instructor who teaches in it, picked at random. */}
      <div>
        <label className={label}>Lesson language</label>
        <select name="preferred_language" defaultValue={student?.preferred_language ?? ""} className={field}>
          <option value="">No preference</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
        </select>
        <p className="mt-1 text-xs text-muted">The instructor is assigned at random among those who teach in it.</p>
      </div>

      {askGuardian && (
      <div>
        <p className="mb-2 text-sm font-semibold">Parent or guardian (optional)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="guardian_name" placeholder="Name" maxLength={120} defaultValue={student?.guardian_name ?? ""} className={field} />
          <input name="guardian_phone" type="tel" placeholder="Phone" maxLength={30} defaultValue={student?.guardian_phone ?? ""} className={field} />
          <input name="guardian_email" type="email" placeholder="Email" maxLength={120} defaultValue={student?.guardian_email ?? ""} className={field} />
        </div>
      </div>
      )}

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
        {/* Editing: the branch changes only with Move and a reason (2026-10-20). */}
        {student && <input type="hidden" name="branch_id" value={student.branch_id ?? ""} />}
        {branches.length > 0 && !student && (
          <div>
            <label className={label}>Branch</label>
            <select name="branch_id" defaultValue="" className={field}>
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
          <p className="mb-3 text-xs text-muted">
            {portal ? "Not shown to operators, instructors or the student portal." : "Not shown to operators or instructors."}
          </p>
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
          <button type="button" onClick={() => (inSheet ? sheet.close() : setOpen(false))} className="px-4 py-2.5 text-sm text-muted">
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
export function PortalLinkBox({ studentId, hasLink, host }: { studentId: string; hasLink: boolean; host?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createPortalLink(studentId);
      if (r.error || !r.value) return setError(r.error);
      setError(null);
      // The school's own verified address when it has one, else ControlMiles.
      setUrl(`${host ? `https://${host}` : window.location.origin}/student/${r.value}`);
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
// Settings layout (redesign 2026-10-20): each setting is a row with its
// name and a one-line explanation on the left and the control on the
// right, grouped under small headings, one Save bar per card.

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
    <form action={action}>
      <div className="divide-y divide-border border-y border-border">
        {showBooking ? (
          <>
            <div>
              <GroupTitle>Online booking</GroupTitle>
              <SettingRow
                title="Students book from their link"
                help="They see your instructors' free times and book; the class shows up in Classes and in the instructor's app."
              >
                <Switch name="booking_enabled" defaultChecked={settings.booking_enabled} label="Online booking" />
              </SettingRow>
            </div>
            <SettingRow title="Minimum notice" help="How long before a lesson it can still be booked.">
              <UnitInput name="booking_lead_hours" defaultValue={settings.booking_lead_hours} unit="hours" min={0} max={336} />
            </SettingRow>
            <SettingRow
              title="Lesson hours"
              help="Lessons can only be scheduled between these hours, for example 8:00 AM to 9:00 PM. Students can still book at any time of day or night. Leave empty for no limit."
            >
              <div className="flex items-center gap-2 text-sm">
                <input
                  name="booking_open_time"
                  type="time"
                  defaultValue={settings.booking_open_time?.slice(0, 5) ?? ""}
                  aria-label="First lesson can start at"
                  className={`${field} w-32`}
                />
                <span className="text-muted">to</span>
                <input
                  name="booking_close_time"
                  type="time"
                  defaultValue={settings.booking_close_time?.slice(0, 5) ?? ""}
                  aria-label="Last lesson must end by"
                  className={`${field} w-32`}
                />
              </div>
            </SettingRow>
            <SettingRow title="Booking window" help="How far ahead students can book, for example into next January.">
              <select name="booking_horizon_days" defaultValue={settings.booking_horizon_days} className={`${field} w-48`}>
                {[
                  [14, "2 weeks"],
                  [30, "1 month"],
                  [60, "2 months"],
                  [90, "3 months"],
                  [180, "6 months"],
                  [270, "9 months"],
                  [365, "1 year"],
                ]
                  .concat(
                    [14, 30, 60, 90, 180, 270, 365].includes(settings.booking_horizon_days)
                      ? []
                      : [[settings.booking_horizon_days, `${settings.booking_horizon_days} days`]],
                  )
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([d, label]) => (
                    <option key={d} value={d}>
                      {label}
                    </option>
                  ))}
              </select>
            </SettingRow>
            <SettingRow title="Upcoming lessons per student" help="Lessons a student can hold booked at once.">
              <UnitInput name="booking_max_upcoming" defaultValue={settings.booking_max_upcoming} unit="lessons" min={1} max={20} />
            </SettingRow>

            <div>
              <GroupTitle>Cancellations</GroupTitle>
              <SettingRow
                title="Free cancellation"
                help="Up to this many hours before the lesson. Later, it counts as a used lesson."
              >
                <UnitInput name="cancel_free_hours" defaultValue={settings.cancel_free_hours} unit="hours before" min={0} max={336} />
              </SettingRow>
            </div>
            <div className="py-4">
              <p className="text-sm font-medium">Cancellation policy</p>
              <p className="mt-0.5 mb-2 text-xs text-muted">
                Students read and accept it before booking. A freed time is emailed to the program&apos;s other students.
              </p>
              <textarea
                name="cancellation_policy"
                rows={3}
                maxLength={1000}
                defaultValue={settings.cancellation_policy ?? ""}
                placeholder="e.g. Cancel up to 24 hours before for free. Later cancellations count as a used lesson."
                className={field}
              />
            </div>
          </>
        ) : (
          <>
            {hidden("booking_lead_hours", settings.booking_lead_hours)}
            {hidden("booking_horizon_days", settings.booking_horizon_days)}
            {settings.booking_open_time && hidden("booking_open_time", settings.booking_open_time.slice(0, 5))}
            {settings.booking_close_time && hidden("booking_close_time", settings.booking_close_time.slice(0, 5))}
            {hidden("booking_max_upcoming", settings.booking_max_upcoming)}
            {hidden("cancel_free_hours", settings.cancel_free_hours)}
            {settings.booking_enabled && hidden("booking_enabled", "on")}
            {settings.cancellation_policy && hidden("cancellation_policy", settings.cancellation_policy)}
          </>
        )}
        {showReminder ? (
          <div>
            <GroupTitle>Reminders</GroupTitle>
            <SettingRow
              title="Email reminder"
              help="Sent to the student, and to the parent or guardian when the program has one."
            >
              <UnitInput name="reminder_hours" defaultValue={settings.reminder_hours} unit="hours before" min={1} max={168} />
            </SettingRow>
          </div>
        ) : (
          hidden("reminder_hours", settings.reminder_hours)
        )}
      </div>
      <div className="flex items-center justify-end gap-3 pt-4">
        <Feedback state={state} ok="Saved." />
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

// ---------------- programs ----------------
function programSummary(p: Program): string {
  const parts = [
    p.required_minutes > 0 ? `${p.required_minutes / 60} h required` : "No required hours",
    p.required_night_minutes > 0 ? `${p.required_night_minutes / 60} h at night` : null,
    `${p.class_minutes}-min lessons`,
    p.notify_guardian ? "Parent or guardian" : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

function ProgramEditor({ program, onDone }: { program?: Program; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = await saveProgram(p, fd);
    if (r.success) onDone();
    return r;
  }, initial);
  return (
    <form action={action} className="my-3 space-y-1 rounded-xl bg-surface p-4">
      {program && <input type="hidden" name="id" value={program.id} />}
      {program && <input type="hidden" name="has_active" value="1" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Name</label>
          <input name="name" required maxLength={60} defaultValue={program?.name ?? ""} placeholder="e.g. Teen" className={field} />
        </div>
        <div>
          <label className={label}>Lesson length</label>
          <UnitInput name="class_minutes" defaultValue={program?.class_minutes ?? 60} unit="minutes" min={15} max={480} step={15} />
        </div>
        <div>
          <label className={label}>Hours required</label>
          <UnitInput name="required_hours" defaultValue={(program?.required_minutes ?? 0) / 60} unit="hours" min={0} max={200} step={0.5} />
          <p className="mt-1 text-xs text-muted">Your state&apos;s rule for this group, or 0 for none.</p>
        </div>
        <div>
          <label className={label}>Of them at night</label>
          <UnitInput name="required_night_hours" defaultValue={(program?.required_night_minutes ?? 0) / 60} unit="hours" min={0} max={200} step={0.5} />
        </div>
      </div>
      <div className="divide-y divide-border">
        <SettingRow title="Parent or guardian" help="Ask for one when registering, and copy them on reminders. Usually on for teens.">
          <Switch name="notify_guardian" defaultChecked={program?.notify_guardian ?? false} label="Parent or guardian" />
        </SettingRow>
        {program && (
          <SettingRow title="Active" help="Off: no longer offered when registering students.">
            <Switch name="is_active" defaultChecked={program.is_active} label="Active" />
          </SettingRow>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 pt-2">
        <Feedback state={state} />
        <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : program ? "Save program" : "Add program"}
        </button>
      </div>
    </form>
  );
}

export function ProgramRow({ program }: { program: Program }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ProgramEditor program={program} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {program.name}
          {!program.is_active && <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">Off</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted">{programSummary(program)}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className={secondaryBtn}>
        Edit
      </button>
    </div>
  );
}

export function AddProgram() {
  const [open, setOpen] = useState(false);
  if (open) return <ProgramEditor onDone={() => setOpen(false)} />;
  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-accent hover:underline">
        + Add program
      </button>
    </div>
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
    <form action={action} className="flex flex-wrap items-center gap-2 pt-4">
      <input name="category" placeholder="Category (e.g. Parking)" maxLength={60} className={`${field} sm:w-48`} />
      <input name="name" placeholder="New skill" maxLength={80} className={`${field} sm:w-56`} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add skill
      </button>
      <Feedback state={state} />
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
    <form action={action} className="flex flex-wrap items-center gap-2 pt-4">
      <input name="name" placeholder="Name (e.g. 6-hour teen package)" maxLength={80} className={`${field} sm:w-64`} />
      <input name="hours" type="number" min="0.5" step="0.5" placeholder="Hours" className={`${field} w-24`} />
      <input name="price" type="number" min="0" step="0.01" placeholder="Price $" className={`${field} w-28`} />
      <button type="submit" disabled={pending} className={secondaryBtn}>
        Add package
      </button>
      <Feedback state={state} />
    </form>
  );
}
