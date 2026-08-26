"use client";

import { useActionState } from "react";
import { renameOrganization, type RenameOrgState } from "./actions";

const initialState: RenameOrgState = { error: null, success: false };

export function RenameOrgForm({ orgId, currentName }: { orgId: string; currentName: string }) {
  const [state, formAction, pending] = useActionState(renameOrganization, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-end">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex-1">
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Fleet name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={currentName}
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.success && <p className="text-sm text-success sm:basis-full">Saved.</p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
