"use client";

import { useActionState } from "react";
import { setAllowDriverOwnedVehicles, type OwnerOperatorState } from "./actions";

const initialState: OwnerOperatorState = { error: null, success: false };

// Owner-operators (2026-09-30): drivers who drive their own truck for the
// fleet. When on, a driver with no company vehicle can register their own
// in the app; it appears in Team marked "Driver-owned" and counts toward
// the plan's vehicle limit like any other vehicle.
export function OwnerOperatorForm({ orgId, allowed }: { orgId: string; allowed: boolean }) {
  const [state, formAction, pending] = useActionState(setAllowDriverOwnedVehicles, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="org_id" value={orgId} />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="allow"
          defaultChecked={allowed}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium">Drivers can use their own vehicle (owner-operators)</span>
          <span className="mt-1 block text-sm text-muted">
            A driver without a company vehicle can register the truck or car they own in the app and drive it
            for your fleet. It shows in Team as driver-owned and counts toward your plan&apos;s vehicles.
          </span>
        </span>
      </label>
      {pending && <p className="mt-2 text-sm text-muted">Saving…</p>}
      {!pending && state.success && <p className="mt-2 text-sm text-success">Saved.</p>}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
