"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addDriver, type AddDriverState } from "./actions";

const initialState: AddDriverState = { error: null, result: null };

// Which roles the form OFFERS is only UX -- which roles THIS caller may
// actually grant is enforced server-side in create_driver_invite and
// re-checked there whatever this form sends.
const ROLE_OPTIONS: Record<"owner" | "admin" | "operator", { value: string; label: string }[]> = {
  owner: [
    { value: "driver", label: "Driver" },
    { value: "operator", label: "Operator" },
    { value: "admin", label: "Admin" },
  ],
  admin: [
    { value: "driver", label: "Driver" },
    { value: "operator", label: "Operator" },
  ],
  operator: [{ value: "driver", label: "Driver" }],
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

// One card for adding a driver (explicit user request, 2026-09-26). It used
// to be two: "Invite a driver" (emailed an invitation) and "Add driver (no
// account yet)" (a one-time code to hand over by hand). Now: name + email and
// the invitation is emailed. The one-time code is still here, one click away,
// for a driver with no email.
export function AddDriverForm({
  orgId,
  callerRole,
}: {
  orgId: string;
  callerRole: "owner" | "admin" | "operator";
}) {
  const [state, formAction, pending] = useActionState(addDriver, initialState);
  const [byCode, setByCode] = useState(false);
  const [copied, setCopied] = useState(false);
  // The result panel stays until the admin says "add another"; remembering the
  // dismissed result object (not a boolean) means the next submit shows again.
  const [dismissed, setDismissed] = useState<AddDriverState["result"]>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const roleOptions = ROLE_OPTIONS[callerRole] ?? ROLE_OPTIONS.operator;

  useEffect(() => {
    if (state.result) formRef.current?.reset();
  }, [state.result]);

  const shown = state.result && state.result !== dismissed ? state.result : null;

  if (shown?.kind === "code") {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-medium">Driver added: {shown.displayId}</p>
        <p className="mt-1 text-sm text-muted">
          Give them this one-time code to link their ControlMiles account. It
          won&apos;t be shown again.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-lg bg-[var(--code-bg)] px-4 py-2 font-mono text-lg tracking-[0.25em] text-[var(--code-foreground)]">
            {shown.claimCode}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shown.claimCode);
              setCopied(true);
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => {
            setDismissed(state.result);
            setCopied(false);
          }}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Add another driver
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="delivery" value={byCode ? "code" : "email"} />
      <p className="text-sm font-medium">Add a driver</p>

      {shown?.kind === "invited" && (
        <p
          role="status"
          className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success"
        >
          Invitation sent to {shown.email}. They&apos;ll show below as Invited until
          they accept.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="first_name" className="mb-1.5 block text-xs font-medium text-muted">
            First name
          </label>
          <input
            id="first_name"
            name="first_name"
            required
            placeholder="Jane"
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="last_name" className="mb-1.5 block text-xs font-medium text-muted">
            Last name
          </label>
          <input
            id="last_name"
            name="last_name"
            required
            placeholder="Doe"
            className={inputClass}
          />
        </div>
      </div>

      {!byCode && (
        <>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="driver@example.com"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">
              We email them an invitation. They set their own password, then log
              in on the app with the driver ID we assign now, not their email.
            </p>
          </div>
          {roleOptions.length > 1 && (
            <div>
              <label htmlFor="role" className="mb-1.5 block text-xs font-medium text-muted">
                Role
              </label>
              <select id="role" name="role" defaultValue="driver" className={inputClass}>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                Operator and Admin get real dashboard access on top of the mobile app.
              </p>
            </div>
          )}
        </>
      )}

      {byCode && (
        <p className="text-xs text-muted">
          No email needed: you&apos;ll get a one-time code to hand to the driver in
          person, and they link their account with it in the app.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (byCode ? "Adding…" : "Sending…") : byCode ? "Add driver" : "Send invitation"}
        </button>
        <button
          type="button"
          onClick={() => setByCode((v) => !v)}
          className="text-sm text-accent hover:underline"
        >
          {byCode ? "Send an email invitation instead" : "No email? Use a one-time code"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
