"use client";

import { useState, useTransition } from "react";
import { setMemberAdmin } from "./actions";

export function AdminButton({
  orgId,
  userId,
  isAdmin,
}: {
  orgId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const result = await setMemberAdmin(orgId, userId, !isAdmin);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        className={`text-xs transition hover:underline disabled:opacity-60 ${
          isAdmin ? "text-muted" : "text-accent"
        }`}
      >
        {pending ? "Updating…" : isAdmin ? "Revoke admin" : "Make admin"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
