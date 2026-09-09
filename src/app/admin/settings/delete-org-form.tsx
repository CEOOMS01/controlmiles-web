"use client";

import { useActionState, useState } from "react";
import { deleteOrganizationAction, type DeleteOrgState } from "./actions";

const initialState: DeleteOrgState = { error: null };

export function DeleteOrgForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState(deleteOrganizationAction, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/5"
      >
        Delete organization
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="actual_name" value={orgName} />

      <p className="text-sm text-muted">
        This permanently deletes <span className="font-semibold text-foreground">{orgName}</span>{" "}
        — every driver, vehicle, route, and inspection record tied to it.
        Trip mileage history is preserved for each driver&apos;s own
        records, unlinked from this fleet. This cannot be undone.
      </p>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Type <span className="font-mono">{orgName}</span> to confirm
        </label>
        <input
          name="confirm_name"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || confirmText !== orgName}
          className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
          className="rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
