"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addBranch,
  archiveBranch,
  selectBranch,
  setMemberBranch,
  setVehicleBranch,
  type BranchFormState,
} from "./branch-actions";

type BranchOption = { id: string; name: string };

const selectClass =
  "rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent disabled:opacity-60";

/** Sidebar filter: every page shows only the chosen branch. */
export function BranchSelector({ branches, current }: { branches: BranchOption[]; current: string | null }) {
  const [pending, startTransition] = useTransition();
  if (branches.length === 0) return null;
  return (
    <label className="mt-3 block px-2">
      <span className="mb-1 block text-[11px] font-semibold tracking-wide text-muted uppercase">Branch</span>
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => startTransition(() => selectBranch(e.target.value))}
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Team page: a vehicle's branch. */
export function VehicleBranchSelect({
  vehicleId,
  current,
  branches,
}: {
  vehicleId: string;
  current: string | null;
  branches: BranchOption[];
}) {
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span>
      <select
        aria-label="Vehicle branch"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const res = await setVehicleBranch(vehicleId, next || null);
            if (res.error) {
              setValue(prev);
              setError(res.error);
            }
          });
        }}
        className={selectClass}
      >
        <option value="">No branch</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </span>
  );
}

/** Team page: a driver's home branch, or any branch. */
export function MemberBranchSelect({
  userId,
  current,
  branches,
}: {
  userId: string;
  current: string; // branch id | "any" | ""
  branches: BranchOption[];
}) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span>
      <select
        aria-label="Driver branch"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const res = await setMemberBranch(userId, next);
            if (res.error) {
              setValue(prev);
              setError(res.error);
            }
          });
        }}
        className={selectClass}
      >
        <option value="">No branch</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        <option value="any">Any branch</option>
      </select>
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </span>
  );
}

const initialState: BranchFormState = { error: null, success: false };

/** Settings: the fleet's branches. */
export function BranchesManager({
  branches,
}: {
  branches: { id: string; name: string; address: string | null; phone: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(addBranch, initialState);
  const [archiving, startArchive] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-medium">Branches</p>
      <p className="mt-1 text-sm text-muted">
        Locations of your business (for example, each office or yard). Put each vehicle and driver in a branch on
        the Team page, then filter the whole dashboard by branch from the sidebar. A driver can also work at any
        branch.
      </p>

      {branches.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1">
                <span className="font-medium">{b.name}</span>
                {(b.address || b.phone) && (
                  <span className="block text-xs text-muted">{[b.address, b.phone].filter(Boolean).join(" · ")}</span>
                )}
              </span>
              <button
                type="button"
                disabled={archiving}
                onClick={() =>
                  startArchive(async () => {
                    const res = await archiveBranch(b.id);
                    setError(res.error);
                  })
                }
                className="text-xs text-muted hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <form action={formAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input name="name" placeholder="Name (e.g. Frederick)" required maxLength={80} className={input} />
        <input name="address" placeholder="Address (optional)" className={input} />
        <input name="phone" placeholder="Phone (optional)" className={input} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
    </div>
  );
}
