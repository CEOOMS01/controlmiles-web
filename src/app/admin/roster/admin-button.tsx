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
    <div className="flex flex-col gap-1">
      <button
        role="menuitem"
        onClick={toggle}
        disabled={pending}
        className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-background disabled:opacity-60 ${
          isAdmin ? "text-muted" : "text-accent"
        }`}
      >
        {pending ? "Updating…" : isAdmin ? "Revoke admin" : "Make admin"}
      </button>
      {error && (
        <p role="alert" className="px-3 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
