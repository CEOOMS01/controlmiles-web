"use client";

import { useState, useTransition } from "react";
import { removeDriverSlot } from "./actions";

export function RemoveSlotButton({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    startTransition(async () => {
      const result = await removeDriverSlot(slotId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRemove}
        disabled={pending}
        className="text-xs text-danger transition hover:underline disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
