"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteMember, type InviteState } from "./actions";

const initialState: InviteState = { error: null, success: false };

export function InviteForm({ orgId }: { orgId: string }) {
  const [state, formAction, pending] = useActionState(inviteMember, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex-1">
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Invite a driver by email
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
          They need an existing ControlMiles account to be invited.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
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
