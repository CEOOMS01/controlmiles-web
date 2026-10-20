"use client";

import { SaveStatus, Segmented, SettingRow } from "@/components/settings-ui";

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
    <SettingRow
      title="Vehicle assignment"
      help="Fixed: each driver uses the vehicle you assign, or the one on their class or shift. Open: drivers pick any free vehicle when they start."
    >
      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="org_id" value={orgId} />
        <SaveStatus pending={pending} success={state.success} error={state.error} />
        <Segmented
          name="vehicle_assignment_mode"
          value={currentMode}
          disabled={pending}
          autoSubmit
          options={[
            { value: "fixed", label: "Fixed" },
            { value: "open", label: "Open" },
          ]}
        />
      </form>
    </SettingRow>
  );
}
