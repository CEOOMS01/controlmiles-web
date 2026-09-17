"use client";

import { useState, useTransition } from "react";
import { removeMember } from "./actions";

export function RemoveButton({ membershipId }: { membershipId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    startTransition(async () => {
      const result = await removeMember(membershipId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        role="menuitem"
        onClick={handleRemove}
        disabled={pending}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-background disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p role="alert" className="px-3 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
