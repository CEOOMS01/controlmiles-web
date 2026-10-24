"use client";

// School route details: edit name, school, start time and service days, and
// delete (or archive, when it has history) the route.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimeInput } from "@/components/time-input";
import { WEEKDAYS } from "@/lib/school";
import { deleteSchoolRoute, publishSchoolRoute, updateSchoolRoute } from "./actions";
import { ActionForm, inputClass } from "./form-kit";

type Option = { id: string; label: string };

export function EditSchoolRouteForm({
  routeId,
  name,
  schoolId,
  startTime,
  days,
  schools,
  timeFormat,
}: {
  routeId: string;
  name: string;
  schoolId: string | null;
  startTime: string | null;
  days: number[];
  schools: Option[];
  timeFormat: "12h" | "24h";
}) {
  return (
    <ActionForm action={updateSchoolRoute} submitLabel="Save details">
      <input type="hidden" name="route_id" value={routeId} />
      <div>
        <label className="mb-1.5 block text-sm font-medium">Route name</label>
        <input name="name" required maxLength={120} defaultValue={name} className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">School</label>
        <select name="school_site_id" defaultValue={schoolId ?? ""} className={inputClass}>
          <option value="">—</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Start time</label>
        <TimeInput name="scheduled_start_time" format={timeFormat} defaultValue={startTime ?? undefined} />
      </div>
      <fieldset className="sm:col-span-3">
        <legend className="mb-1.5 block text-sm font-medium">Service days</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {WEEKDAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-1.5">
              <input type="checkbox" name="service_days" value={d.n} defaultChecked={days.includes(d.n)} />
              {d.short}
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}

export function DeleteSchoolRoute({ routeId, routeName }: { routeId: string; routeName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-4 rounded-xl border border-danger/30 p-4">
      <p className="text-sm font-medium">Delete this route</p>
      <p className="mt-1 text-xs text-muted">
        A route that never ran is removed with its stops. One that has already run is archived instead, so its
        attendance history is kept; it disappears from the lists and from the drivers&apos; app.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete "${routeName}"?`)) return;
          start(async () => {
            const r = await deleteSchoolRoute(routeId);
            if (r.error) return setError(r.error);
            if (r.archived) window.alert("This route has history, so it was archived instead of deleted.");
            router.push("/admin/school/routes");
          });
        }}
        className="mt-3 rounded-lg border border-danger px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete route"}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function PublishBanner({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div>
        <p className="text-sm font-semibold">Draft</p>
        <p className="text-xs text-muted">This route is not in the drivers&apos; app yet. Publish it when the stops and students are ready.</p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await publishSchoolRoute(routeId);
            if (r.error) return setError(r.error);
            router.refresh();
          })
        }
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish route"}
      </button>
    </div>
  );
}
