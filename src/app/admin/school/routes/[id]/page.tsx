// School transportation (2026-10-09): one school route -- the pick-up viewer
// for a day (today by default, live while the route runs) in the day colors
// of lib/school-status (blue on track, red alert, yellow absent, gray
// released with a reason), its stops in order
// (each with a map location and arrival radius), the students who board or
// get off at each stop, and the last runs.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { TimeInput } from "@/components/time-input";
import { ROUTE_TYPE_LABEL, STOP_KIND_LABEL, clock, daysLabel, fleetNow } from "@/lib/school";
import { RELEASE_REASON_LABEL, STATUS_PILL, dueStopIds, loadRodeAm, runStatuses } from "@/lib/school-status";
import { AutoRefresh } from "../../auto-refresh";
import { AddressAutocompleteInput } from "../../../routes/address-autocomplete-input";
import { addStop, assignStudent, deleteStop, moveStop, saveSchoolRouteCrew, unassignStudent } from "../../actions";
import { loadCrewOptions } from "@/lib/school-crew";
import { driverLabel } from "@/lib/driver-label";
import { ActionForm, RowButton, inputClass } from "../../form-kit";

export default async function SchoolRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  const orgId = profile?.default_org_id;
  if (!user || !orgId) return null;

  const { data: route } = await supabase
    .from("routes")
    .select("id, name, route_type, service_days, scheduled_start_time, school_site_id, organization_id, assigned_driver_id, assigned_vehicle_id, monitor_name")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!route || (route.route_type !== "school_am" && route.route_type !== "school_pm")) notFound();

  const [{ data: stops }, { data: assignments }, { data: students }, { data: runs }, { data: me }, { data: school }, { data: org }, crew, { data: currentDriver }] =
    await Promise.all([
      supabase
        .from("route_stops")
        .select("id, seq, name, address, scheduled_time, stop_kind, radius_meters")
        .eq("route_id", id)
        .order("seq"),
      supabase.from("student_stop_assignments").select("id, stop_id, student_id, action").eq("route_id", id),
      supabase
        .from("students")
        .select("id, first_name, last_initial, grade")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("first_name"),
      supabase
        .from("route_runs")
        .select("id, run_date, status, started_at, completed_at, child_check_at")
        .eq("route_id", id)
        .order("run_date", { ascending: false })
        .limit(10),
      supabase.from("profiles").select("time_format").eq("id", user.id).maybeSingle(),
      route.school_site_id
        ? supabase.from("school_sites").select("name").eq("id", route.school_site_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("organizations").select("timezone").eq("id", orgId).maybeSingle(),
      loadCrewOptions(supabase, orgId),
      route.assigned_driver_id
        ? supabase.from("profiles").select("first_name, last_name").eq("id", route.assigned_driver_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  // The assigned driver may not be a "driver" member (e.g. the owner drives).
  const driverOptions =
    route.assigned_driver_id && !crew.drivers.some((d) => d.id === route.assigned_driver_id)
      ? [{ id: route.assigned_driver_id, label: driverLabel(currentDriver, null, "Current driver") }, ...crew.drivers]
      : crew.drivers;
  const tz = org?.timezone ?? "America/New_York";
  const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

  const timeFormat: "12h" | "24h" = me?.time_format === "24h" ? "24h" : "12h";
  const studentName = new Map(
    (students ?? []).map((s) => [s.id, `${s.first_name}${s.last_initial ? ` ${s.last_initial}.` : ""}`]),
  );
  const byStop = new Map<string, { id: string; student_id: string; action: string }[]>();
  for (const a of assignments ?? []) byStop.set(a.stop_id, [...(byStop.get(a.stop_id) ?? []), a]);

  // Pick-up viewer: the chosen day's run (today by default).
  const viewDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : fleetNow(tz).date;
  const viewRun = (runs ?? []).find((r) => r.run_date === viewDate) ?? null;
  const [{ data: viewEvents }, { data: viewRides }, rodeAm] = viewRun
    ? await Promise.all([
        supabase.from("route_stop_events").select("stop_id, arrived_at, departed_at").eq("run_id", viewRun.id),
        supabase.from("ridership_events").select("student_id, action, at, reason, note").eq("run_id", viewRun.id),
        loadRodeAm(supabase, orgId, viewDate, viewDate),
      ])
    : [{ data: [] }, { data: [] }, new Set<string>()];
  const arrivedAt = new Map((viewEvents ?? []).map((e) => [e.stop_id, e.arrived_at]));
  const finished = viewRun?.status === "completed";
  const statuses = runStatuses({
    routeType: route.route_type,
    completed: finished,
    dueStops: dueStopIds(viewEvents ?? []),
    assignments: assignments ?? [],
    rides: viewRides ?? [],
    rodeAm: (studentId) => rodeAm.has(`${viewDate}:${studentId}`),
  });
  const pickupTotals = { blue: 0, gray: 0, yellow: 0, red: 0, waiting: 0 };
  for (const a of assignments ?? []) {
    if (a.action !== "board") continue;
    const st = statuses.get(`${a.student_id}:board`)?.status;
    if (st === "blue" || st === "gray" || st === "yellow" || st === "red") pickupTotals[st]++;
    else pickupTotals.waiting++;
  }
  const isPm = route.route_type === "school_pm";

  return (
    <main className="space-y-8 px-6 py-10 sm:px-10">
      <div>
        <Link href="/admin/school/routes" className="text-sm text-muted hover:text-accent">
          ← School routes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{route.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {ROUTE_TYPE_LABEL[route.route_type]}
          {school?.name ? ` · ${school.name}` : ""} · starts {clock(route.scheduled_start_time, timeFormat)} ·{" "}
          {daysLabel(route.service_days)}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Crew</h2>
        <ActionForm action={saveSchoolRouteCrew} submitLabel="Save crew">
          <input type="hidden" name="route_id" value={id} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Driver</label>
            <select name="driver_id" defaultValue={route.assigned_driver_id ?? ""} className={inputClass}>
              <option value="">Unassigned</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bus</label>
            <select name="vehicle_id" defaultValue={route.assigned_vehicle_id ?? ""} className={inputClass}>
              <option value="">Unassigned</option>
              {crew.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bus monitor</label>
            <input
              name="monitor_name"
              defaultValue={route.monitor_name ?? ""}
              maxLength={80}
              placeholder="Aide's name (optional)"
              className={inputClass}
            />
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        {viewRun?.status === "in_progress" && <AutoRefresh seconds={15} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pick-ups · {viewDate}</h2>
            <p className="text-sm text-muted">
              {!viewRun
                ? "This route hasn't run on this day."
                : [
                    viewRun.status === "completed" ? "Completed" : "Running now",
                    `${pickupTotals.blue} picked up`,
                    pickupTotals.gray && `${pickupTotals.gray} released`,
                    `${pickupTotals.yellow} absent`,
                    pickupTotals.red && `${pickupTotals.red} red alert${pickupTotals.red > 1 ? "s" : ""}`,
                    pickupTotals.waiting && `${pickupTotals.waiting} ${isPm ? "expected" : "waiting"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          <form className="flex items-end gap-2">
            <input type="date" name="date" defaultValue={viewDate} className={inputClass} />
            <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent">
              View day
            </button>
          </form>
        </div>
        {viewRun && (
          <div className="grid gap-3 md:grid-cols-2">
            {(stops ?? []).map((s) => {
              const riders = byStop.get(s.id) ?? [];
              const reached = arrivedAt.get(s.id);
              const riderStates = riders.map((r) => statuses.get(`${r.student_id}:${r.action}`));
              const skippable =
                !reached && riders.length > 0 && riderStates.every((x) => x?.status === "yellow" || x?.status === "gray");
              return (
                <div key={s.id} className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-sm font-semibold">
                    {s.seq}. {s.name}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {reached
                        ? `arrived ${hm(reached)}`
                        : skippable
                          ? "skip · no one here today"
                          : finished
                            ? "not reached"
                            : "not reached yet"}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {riders.map((r, i) => {
                      const st = riderStates[i] ?? { status: "pending" as const, at: null, reason: null, note: null };
                      const board = r.action === "board";
                      const label = {
                        blue: board ? `picked up ${st.at ? hm(st.at) : ""}` : `dropped off ${st.at ? hm(st.at) : ""}`,
                        red: board ? "rode this morning · hasn't come out" : "not dropped off · still on the bus?",
                        yellow: board && !isPm ? "absent" : "absent today",
                        gray: `released · ${RELEASE_REASON_LABEL[st.reason ?? "other"] ?? st.reason}${st.note ? ` (${st.note})` : ""}`,
                        expected: "expected",
                        pending: board ? "waiting" : "on the way",
                        on_board: "on the bus",
                      }[st.status];
                      return (
                        <span key={r.id} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_PILL[st.status]}`}>
                          {studentName.get(r.student_id) ?? "Student"} · {label}
                        </span>
                      );
                    })}
                    {riders.length === 0 && <span className="text-xs text-muted">No riders.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Stops ({stops?.length ?? 0})</h2>
        <p className="max-w-2xl text-sm text-muted">
          The app marks the bus as arrived when it gets within the stop&apos;s radius, even with the phone
          locked. Drivers can also mark it by hand.
        </p>
        <ol className="space-y-3">
          {(stops ?? []).map((s, i) => {
            const riders = byStop.get(s.id) ?? [];
            return (
              <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {i + 1}. {s.name}{" "}
                      <span className="ml-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {STOP_KIND_LABEL[s.stop_kind]}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {clock(s.scheduled_time, timeFormat)} · {s.address ?? "—"} · radius {s.radius_meters} m
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {i > 0 && <RowButton onRun={moveStop.bind(null, id, s.id, "up")} label="↑ Up" />}
                    {i < (stops?.length ?? 0) - 1 && (
                      <RowButton onRun={moveStop.bind(null, id, s.id, "down")} label="↓ Down" />
                    )}
                    <RowButton
                      onRun={deleteStop.bind(null, id, s.id)}
                      label="Remove"
                      danger
                      confirmText={`Remove stop "${s.name}" and its rider list?`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {riders.map((r) => (
                    <span
                      key={r.id}
                      className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
                    >
                      {r.action === "board" ? "↑" : "↓"} {studentName.get(r.student_id) ?? "Student"}
                      <RowButton onRun={unassignStudent.bind(null, id, r.id)} label="✕" />
                    </span>
                  ))}
                  {riders.length === 0 && <span className="text-xs text-muted">No riders at this stop.</span>}
                </div>

                <ActionForm
                  action={assignStudent}
                  submitLabel="Add rider"
                  className="mt-3 grid gap-2 sm:grid-cols-3"
                >
                  <input type="hidden" name="route_id" value={id} />
                  <input type="hidden" name="stop_id" value={s.id} />
                  <select name="student_id" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Student…
                    </option>
                    {(students ?? []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {studentName.get(st.id)}
                        {st.grade ? ` (grade ${st.grade})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    name="action"
                    defaultValue={s.stop_kind === "pickup" ? "board" : "alight"}
                    className={inputClass}
                  >
                    <option value="board">Gets on here</option>
                    <option value="alight">Gets off here</option>
                  </select>
                </ActionForm>
              </li>
            );
          })}
          {(stops ?? []).length === 0 && <li className="text-sm text-muted">No stops yet. Add the first one below.</li>}
        </ol>

        <ActionForm action={addStop} submitLabel="Add stop">
          <input type="hidden" name="route_id" value={id} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">Stop name</label>
            <input name="name" required placeholder="Oak St & 5th Ave" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <AddressAutocompleteInput
              name="address"
              label="Address (pick a suggestion)"
              placeholder="Start typing the stop's address"
              latName="latitude"
              lonName="longitude"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Scheduled time</label>
            <TimeInput name="scheduled_time" format={timeFormat} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type</label>
            <select name="stop_kind" defaultValue="pickup" className={inputClass}>
              <option value="pickup">Pick-up</option>
              <option value="school">School</option>
              <option value="dropoff">Drop-off</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Arrival radius (m)</label>
            <input name="radius_meters" type="number" min={20} max={500} defaultValue={80} className={inputClass} />
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <tbody>
              {(runs ?? []).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.run_date}</td>
                  <td className="px-4 py-3 text-muted">
                    {r.status === "completed" ? "Completed" : "In progress"} · started{" "}
                    {hm(r.started_at)}
                    {r.completed_at &&
                      ` · finished ${hm(r.completed_at)}`}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.child_check_at ? "Child check ✓" : r.status === "completed" ? "No child check" : ""}
                  </td>
                </tr>
              ))}
              {(runs ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted">This route hasn&apos;t run yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
