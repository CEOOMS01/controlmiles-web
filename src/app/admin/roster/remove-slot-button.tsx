"use client";

import { useTransition } from "react";
import { removeDriverSlot } from "./actions";

export function RemoveSlotButton({ slotId }: { slotId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => removeDriverSlot(slotId))}
      disabled={pending}
      className="text-xs text-danger transition hover:underline disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
