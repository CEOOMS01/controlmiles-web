"use client";

import { useActionState } from "react";
import { profileSummary, profileTitle, type FleetProfile } from "@/lib/fleet-profiles";
import { setModuleOptions, type IndustryTemplateState } from "./actions";

const initialState: IndustryTemplateState = { error: null, success: false };

// Fleet profile (2026-09-30, approved plan): the kind of fleet decides
// which modules show in the menu and whether a pre-trip inspection is
// required by default. 2026-10-03: the type itself is chosen once in
// onboarding and locked (set_fleet_type -> FLEET_TYPE_LOCKED; support
// changes it with support_change_fleet_type). The operational switches
// below stay editable: "Show all modules" reveals everything, and the
// inspection toggle overrides the profile's default.
export function IndustryTemplateForm({
  orgId,
  orgName,
  confirmedAt,
  current,
  showAll,
  requirePretrip,
  useShifts,
}: {
  orgId: string;
  orgName: string;
  confirmedAt: string | null;
  current: FleetProfile;
  showAll: boolean;
  requirePretrip: boolean;
  useShifts: boolean;
}) {
  const [optState, optAction, optPending] = useActionState(setModuleOptions, initialState);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Fleet type</p>
            <p className="mt-1 text-lg font-semibold">{profileTitle(current)}</p>
            <p className="mt-1 text-xs text-muted">
              {confirmedAt
                ? `Set ${new Date(confirmedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} during onboarding.`
                : "Set during onboarding."}{" "}
              It decides your fleet&apos;s setup (classes, IFTA, pre-trip default), so it can&apos;t be changed here.
            </p>
          </div>
          <a
            href={`mailto:support@controlmiles.com?subject=${encodeURIComponent("Change fleet type")}&body=${encodeURIComponent(
              `Fleet: ${orgName}\nCurrent type: ${profileTitle(current)}\nNew type:\nReason:\n`,
            )}`}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition hover:border-accent"
          >
            Request a change
          </a>
        </div>
        <ul className="mt-3 space-y-0.5 text-xs text-muted">
          {profileSummary(current).map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </div>

      {/* key: re-mount with fresh defaults when the profile changes them */}
      <form
        key={`${showAll}-${requirePretrip}-${useShifts}`}
        action={optAction}
        className="space-y-3 rounded-xl border border-border bg-surface p-5"
      >
        <input type="hidden" name="org_id" value={orgId} />
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="show_all_modules"
            defaultChecked={showAll}
            disabled={optPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">Show all modules</span>
            <span className="block text-sm text-muted">
              For mixed fleets: show IFTA, routes, geofences and owner-operators even if your profile
              doesn&apos;t use them.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="require_pretrip_inspection"
            defaultChecked={requirePretrip}
            disabled={optPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">Require a pre-trip inspection</span>
            <span className="block text-sm text-muted">
              Drivers must pass a pre-trip inspection (DVIR) each day before their first trip. Standard for
              trucks, construction and passenger transport; optional for cars and vans.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="use_shift_schedules"
            defaultChecked={useShifts}
            disabled={optPending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium">Use shift schedules</span>
            <span className="block text-sm text-muted">
              Schedule drivers&apos; weekly shifts (and classes, for driving schools) on the Shifts page. The app
              then uses the scheduled vehicle and you see who started late. Off: drivers just use their assigned
              vehicle.
            </span>
          </span>
        </label>
        {optPending && <p className="text-sm text-muted">Saving…</p>}
        {!optPending && optState.success && <p className="text-sm text-success">Saved.</p>}
        {optState.error && (
          <p role="alert" className="text-sm text-danger">
            {optState.error}
          </p>
        )}
      </form>
    </div>
  );
}
