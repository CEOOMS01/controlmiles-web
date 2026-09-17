"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteMember, type InviteState } from "./actions";

const initialState: InviteState = { error: null, success: false };

// Explicit user request, 2026-09-18: same form now invites straight into
// Operator/Admin, not just Driver -- role options shown here are just
// UX (which roles THIS caller can actually grant lives server-side in
// create_driver_invite and is re-checked there regardless of what this
// form sends).
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

export function InviteForm({
  orgId,
  callerRole,
}: {
  orgId: string;
  callerRole: "owner" | "admin" | "operator";
}) {
  const [state, formAction, pending] = useActionState(inviteMember, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const roleOptions = ROLE_OPTIONS[callerRole] ?? ROLE_OPTIONS.operator;

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
    >
      <input type="hidden" name="org_id" value={orgId} />
      <p className="text-sm font-medium">Invite a driver</p>
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
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>
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
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <p className="mt-1 text-xs text-muted">
          They&apos;ll get an email to confirm their account and set their own
          password — then log in on the app with the driver ID we assign now,
          not their email.
        </p>
      </div>
      {roleOptions.length > 1 && (
        <div>
          <label htmlFor="role" className="mb-1.5 block text-xs font-medium text-muted">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="driver"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
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
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Inviting…" : "Invite"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
