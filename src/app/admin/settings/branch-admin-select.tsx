"use client";

// Owner only (2026-10-20): the admin who runs a branch.

import { useState, useTransition } from "react";
import { setBranchManager } from "../branch-actions";

export function BranchAdminSelect({
  branchId,
  current,
  admins,
}: {
  branchId: string;
  current: string;
  admins: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <select
        aria-label="Branch admin"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError(null);
          start(async () => {
            const r = await setBranchManager(branchId, next);
            if (r.error) {
              setValue(prev);
              setError(r.error);
            }
          });
        }}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="">No admin yet</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
