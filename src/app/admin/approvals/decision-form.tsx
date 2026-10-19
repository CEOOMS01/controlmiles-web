"use client";

import { useActionState } from "react";
import { decideTrip, type ApprovalState } from "./actions";

const initial: ApprovalState = { error: null };

export function DecisionForm({ sessionId, decided }: { sessionId: string; decided: boolean }) {
  const [state, action, pending] = useActionState(decideTrip, initial);
  const btn =
    "rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accent disabled:opacity-50";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      {decided ? (
        <button type="submit" name="status" value="" disabled={pending} className={btn}>
          Undo
        </button>
      ) : (
        <>
          <input
            name="note"
            maxLength={500}
            placeholder="Note (optional)"
            className="w-40 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
          <button type="submit" name="status" value="approved" disabled={pending} className={btn}>
            Approve
          </button>
          <button type="submit" name="status" value="rejected" disabled={pending} className={btn}>
            Reject
          </button>
        </>
      )}
      {state.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
