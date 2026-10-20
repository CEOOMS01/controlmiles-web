"use client";

import { useActionState } from "react";
import { profileTitle, type FleetProfile } from "@/lib/fleet-profiles";
import { SaveStatus, SettingRow, Switch } from "@/components/settings-ui";
import { setModuleOptions, type IndustryTemplateState } from "./actions";

const initialState: IndustryTemplateState = { error: null, success: false };

// Fleet profile (2026-09-30, approved plan): the kind of fleet decides
// which modules show in the menu and whether a pre-trip inspection is
// required by default. 2026-10-03: the type itself is chosen once in
// onboarding and locked (set_fleet_type -> FLEET_TYPE_LOCKED; support
// changes it with support_change_fleet_type). The service and the plan
// decide what the fleet has (fn_org_features); the switches below only
// cover what it has: the inspection toggle overrides the profile's
// default, and shift schedules show when the plan includes them.
/** The fleet type, chosen once at sign-up (support changes it). */
export function FleetTypeRow({
  orgName,
  confirmedAt,
  current,
}: {
  orgName: string;
  confirmedAt: string | null;
  current: FleetProfile;
}) {
  const since = confirmedAt
    ? `Set ${new Date(confirmedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at sign-up. `
    : "Set at sign-up. ";
  return (
    <SettingRow title="Fleet type" help={`${since}It decides what your fleet includes.`}>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">{profileTitle(current)}</span>
        <a
          href={`mailto:support@controlmiles.com?subject=${encodeURIComponent("Change fleet type")}&body=${encodeURIComponent(
            `Fleet: ${orgName}\nCurrent type: ${profileTitle(current)}\nNew type:\nReason:\n`,
          )}`}
          className="text-sm text-muted hover:text-accent"
        >
          Request a change
        </a>
      </div>
    </SettingRow>
  );
}

/** Pre-trip inspection and shift schedules; each saves when flipped. */
export function ModuleOptionsForm({
  orgId,
  requirePretrip,
  useShifts,
  canUseShifts,
}: {
  orgId: string;
  requirePretrip: boolean;
  useShifts: boolean;
  canUseShifts: boolean;
}) {
  const [optState, optAction, optPending] = useActionState(setModuleOptions, initialState);

  return (
    // key: re-mount with fresh defaults when the profile changes them
    <form key={`${requirePretrip}-${useShifts}`} action={optAction} className="divide-y divide-border">
      <input type="hidden" name="org_id" value={orgId} />
      <SettingRow title="Pre-trip inspection" help="Drivers pass an inspection (DVIR) each day before their first trip.">
        <Switch
          name="require_pretrip_inspection"
          defaultChecked={requirePretrip}
          disabled={optPending}
          autoSubmit
          label="Pre-trip inspection"
        />
      </SettingRow>
      {canUseShifts && (
        <SettingRow
          title="Weekly shift schedules"
          help="Plan drivers' weekly shifts; the app uses the scheduled vehicle and you see who started late."
        >
          <input type="hidden" name="has_shift_toggle" value="1" />
          <Switch name="use_shift_schedules" defaultChecked={useShifts} disabled={optPending} autoSubmit label="Shift schedules" />
        </SettingRow>
      )}
      {(optPending || optState.success || optState.error) && (
        <div className="py-2 text-right">
          <SaveStatus pending={optPending} success={optState.success} error={optState.error} />
        </div>
      )}
    </form>
  );
}
