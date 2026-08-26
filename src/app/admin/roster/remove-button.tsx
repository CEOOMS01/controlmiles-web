"use client";

import { useTransition } from "react";
import { removeMember } from "./actions";

export function RemoveButton({ membershipId }: { membershipId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => removeMember(membershipId))}
      disabled={pending}
      className="text-xs text-danger transition hover:underline disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
