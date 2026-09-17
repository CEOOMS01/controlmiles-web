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
    <div className="flex flex-col gap-1">
      <button
        role="menuitem"
        onClick={toggle}
        disabled={pending}
        className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-background disabled:opacity-60 ${
          isOperator ? "text-muted" : "text-accent"
        }`}
      >
        {pending ? "Updating…" : isOperator ? "Revoke operator" : "Make operator"}
      </button>
      {error && (
        <p role="alert" className="px-3 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
