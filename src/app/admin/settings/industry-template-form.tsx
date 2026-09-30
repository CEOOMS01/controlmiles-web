"use client";

import { useActionState } from "react";
import { FLEET_PROFILES, type FleetProfile } from "@/lib/fleet-profiles";
import { setIndustryTemplate, setModuleOptions, type IndustryTemplateState } from "./actions";

const initialState: IndustryTemplateState = { error: null, success: false };

// Fleet profile (2026-09-30, approved plan): the kind of fleet decides
// which modules show in the menu and whether a pre-trip inspection is
// required by default. Nothing is locked: "Show all modules" reveals
// everything, and the inspection toggle overrides the profile's default.
export function IndustryTemplateForm({
  orgId,
  current,
  showAll,
  requirePretrip,
  useShifts,
}: {
  orgId: string;
  current: FleetProfile;
  showAll: boolean;
  requirePretrip: boolean;
  useShifts: boolean;
}) {
  const [state, formAction, pending] = useActionState(setIndustryTemplate, initialState);
  const [optState, optAction, optPending] = useActionState(setModuleOptions, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
        <input type="hidden" name="org_id" value={orgId} />
        <p className="text-sm font-medium">Fleet profile</p>
        <p className="mt-1 text-sm text-muted">
          Shows the tools that fit your kind of fleet first. Changing it never deletes anything, and it
          resets the pre-trip inspection setting below to that profile&apos;s default.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {FLEET_PROFILES.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                current === t.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="industry_template"
                  value={t.value}
                  defaultChecked={current === t.value}
                  disabled={pending}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                />
                {t.title}
              </span>
              <span className="mt-1 block text-xs text-muted">{t.body}</span>
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
