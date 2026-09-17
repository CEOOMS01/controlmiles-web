"use client";

import { useState, useTransition } from "react";
import { setMemberOperator } from "./actions";

export function OperatorButton({
  orgId,
  userId,
  isOperator,
}: {
  orgId: string;
  userId: string;
  isOperator: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const result = await setMemberOperator(orgId, userId, !isOperator);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        className={`text-xs transition hover:underline disabled:opacity-60 ${
          isOperator ? "text-muted" : "text-accent"
        }`}
      >
        {pending ? "Updating…" : isOperator ? "Revoke operator" : "Make operator"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
