"use client";

import { useTransition } from "react";
import { deleteClassBlock, setClassBlockCancelled } from "./actions";

// Only scheduled/cancelled blocks can be changed; a class that already
// started is history (DB trigger tr_shift_blocks_freeze_started).
export function ClassBlockActions({
  blockId,
  status,
  isOneOff,
}: {
  blockId: string;
  status: string;
  isOneOff: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (status !== "scheduled" && status !== "cancelled") return null;

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      {status === "scheduled" ? (
        <button
          disabled={pending}
          onClick={() => startTransition(() => { void setClassBlockCancelled(blockId, true); })}
          className="text-accent hover:underline disabled:opacity-50"
        >
          Cancel class
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => startTransition(() => { void setClassBlockCancelled(blockId, false); })}
          className="text-accent hover:underline disabled:opacity-50"
        >
          Restore
        </button>
      )}
      {isOneOff && status === "scheduled" && (
        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this class?")) startTransition(() => { void deleteClassBlock(blockId); });
          }}
          className="text-danger hover:underline disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}
