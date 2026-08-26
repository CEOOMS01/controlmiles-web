"use client";

import { useActionState, useState } from "react";
import { addDriverSlot, type AddSlotState } from "./actions";

const initialState: AddSlotState = { error: null, result: null };

export function AddDriverSlotForm({ orgId }: { orgId: string }) {
  const [state, formAction, pending] = useActionState(addDriverSlot, initialState);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (state.result) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-medium">Driver added: {state.result.displayId}</p>
        <p className="mt-1 text-sm text-muted">
          Give them this one-time code to link their ControlMiles account. It
          won&apos;t be shown again.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-lg bg-[var(--code-bg)] px-4 py-2 font-mono text-lg tracking-[0.25em] text-[var(--code-foreground)]">
            {state.result.claimCode}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(state.result!.claimCode);
              setCopied(true);
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Add another driver
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent"
      >
        Add driver (no account yet)
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex-1">
        <label htmlFor="first_name" className="mb-1.5 block text-sm font-medium">
          First name
        </label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <div className="flex-1">
        <label htmlFor="last_name" className="mb-1.5 block text-sm font-medium">
          Last name
        </label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add driver"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
