"use client";

import { useActionState } from "react";
import { createOrganization, type CreateOrgState } from "./actions";

const initialState: CreateOrgState = { error: null };

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Create your fleet</h1>
          <p className="mt-2 text-sm text-muted">
            You don&apos;t have a fleet organization yet. Name it to get
            started — you&apos;ll be able to invite drivers and add
            vehicles next.
          </p>
        </div>

        <form action={formAction} className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Fleet name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              placeholder="Acme Delivery Co."
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            {pending ? "Creating…" : "Create fleet"}
          </button>
        </form>
      </div>
    </main>
  );
}
