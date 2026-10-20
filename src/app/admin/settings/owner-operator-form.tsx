"use client";

import { SaveStatus, SettingRow, Switch } from "@/components/settings-ui";

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
    <SettingRow
      title="Drivers can use their own vehicle"
      help="Owner-operators register the vehicle they own in the app; it counts toward your plan's vehicles."
    >
      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="org_id" value={orgId} />
        <SaveStatus pending={pending} success={state.success} error={state.error} />
        <Switch name="allow" defaultChecked={allowed} disabled={pending} autoSubmit label="Owner-operators" />
      </form>
    </SettingRow>
  );
}
