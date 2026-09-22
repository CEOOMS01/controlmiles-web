"use client";

import { useTransition } from "react";
import { setShiftActive, deleteShift } from "./actions";

export function ShiftRowActions({ shiftId, isActive }: { shiftId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      <button
        disabled={pending}
        onClick={() => startTransition(() => { void setShiftActive(shiftId, !isActive); })}
        className="text-accent hover:underline disabled:opacity-50"
      >
        {isActive ? "Pause" : "Resume"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Remove this shift?")) startTransition(() => { void deleteShift(shiftId); });
        }}
        className="text-danger hover:underline disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
