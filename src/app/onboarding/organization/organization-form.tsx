"use client";

import { useActionState } from "react";
import { createOrganization, type CreateOrgState } from "./actions";

const initialState: CreateOrgState = { error: null };

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium">
          Company / fleet name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          required
          autoComplete="organization"
          autoFocus
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
