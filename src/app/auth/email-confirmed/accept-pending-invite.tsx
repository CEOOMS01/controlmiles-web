"use client";

import { useState, useTransition } from "react";
import { acceptMyPendingInvite } from "@/app/invite/[token]/actions";

// Shown on the "Email confirmed" page when the person was invited to a fleet and has
// not accepted yet: without this step the invitation stays pending and the user ID
// cannot sign in to the app.
export function AcceptPendingInvite({ organizationName, role }: { organizationName: string; role: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roleText = role === "monitor" ? "a bus monitor" : role === "admin" ? "an admin" : role === "operator" ? "an operator" : "a driver";
  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
      <p className="text-sm">
        You were invited to join <strong>{organizationName}</strong> as {roleText}. One last step: accept the invitation.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptMyPendingInvite();
            if (r?.error) setError(r.error);
          })
        }
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invitation"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
