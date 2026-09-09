"use client";

import { useActionState } from "react";
import { setVehicleAssignmentMode, type VehicleAssignmentModeState } from "./actions";

const initialState: VehicleAssignmentModeState = { error: null, success: false };

export function VehicleAssignmentModeForm({
  orgId,
  currentMode,
}: {
  orgId: string;
  currentMode: "fixed" | "open";
}) {
  const [state, formAction, pending] = useActionState(setVehicleAssignmentMode, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="org_id" value={orgId} />
      <p className="text-sm font-medium">Vehicle assignment</p>
      <p className="mt-1 text-sm text-muted">
        Fixed: each driver uses the one vehicle you assign them (Roster page).
        Open: a driver picks any unclaimed fleet vehicle when they start their turno --
        for a rotating fleet where vehicles aren&apos;t 1:1 with drivers.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {(["fixed", "open"] as const).map((mode) => (
          <label
            key={mode}
            className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-sm transition ${
              currentMode === mode
                ? "border-accent bg-accent/10 font-semibold"
                : "border-border hover:border-accent/50"
            }`}
          >
            <input
              type="radio"
              name="vehicle_assignment_mode"
              value={mode}
              defaultChecked={currentMode === mode}
              disabled={pending}
              className="mr-2"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            {mode === "fixed" ? "Fixed" : "Open / rotating"}
          </label>
        ))}
      </div>

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
