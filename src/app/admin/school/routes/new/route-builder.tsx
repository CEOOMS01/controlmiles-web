"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/school/routes/new/route-builder.tsx
//
// School route builder, end to end on one page (2026-10-24, no map and no cards
// per the owner: the map lives on the live Dashboard only; after how bus
// routing tools work: BusRight's one-page route editor with a map beside the
// stop list, BusBoss / Upper / UniteGPS: geocoded addresses, stops in order
// with times, crew, save for later or publish to the drivers):
//   1. Details  2. Crew  3. Stops (search an address or click the map, drag a
//   pin to adjust, reorder, time each stop)  4. Save as draft or publish.
// Students are assigned to the stops right after, on the route page.

import { useActionState, useRef, useState, useTransition } from "react";
import { TimeInput } from "@/components/time-input";
import { WEEKDAYS } from "@/lib/school";
import { AddressAutocompleteInput } from "../../../routes/address-autocomplete-input";
import { createSchoolRouteWithStops, suggestRouteStops, type FormResult } from "../../actions";
import { inputClass } from "../../form-kit";
import { MonitorPicker } from "../../monitor-picker";

type Option = { id: string; label: string };
type School = { id: string; label: string; lat: number | null; lng: number | null; address: string | null };
type Stop = {
  key: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  time: string;
  kind: "pickup" | "school" | "dropoff";
  radius: number;
  students: { id: string; name: string }[];
};

let counter = 0;
const newKey = () => `s${Date.now().toString(36)}${counter++}`;

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const hhmm = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function RouteBuilder({
  schools,
  drivers,
  monitors,
  vehicles,
  timeFormat,
}: {
  schools: School[];
  drivers: Option[];
  monitors: Option[];
  vehicles: Option[];
  timeFormat: "12h" | "24h";
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(createSchoolRouteWithStops, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const [runType, setRunType] = useState<"school_am" | "school_pm">("school_am");
  const [schoolId, setSchoolId] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [gap, setGap] = useState(3);
  const [note, setNote] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [suggestInfo, setSuggestInfo] = useState<string | null>(null);
  const [includeRouted, setIncludeRouted] = useState(false);

  const school = schools.find((s) => s.id === schoolId);
  const hasSchoolStop = stops.some((s) => s.kind === "school");
  const lengthKm = stops.slice(1).reduce((sum, s, i) => sum + km(stops[i], s), 0);

  const patch = (key: string, p: Partial<Stop>) => setStops((all) => all.map((s) => (s.key === key ? { ...s, ...p } : s)));

  function addStop(s: Omit<Stop, "key" | "radius" | "time" | "kind" | "students"> & Partial<Pick<Stop, "kind">>, atStart = false) {
    const stop: Stop = { key: newKey(), radius: 80, time: "", kind: "pickup", students: [], ...s };
    setStops((all) => (atStart ? [stop, ...all] : [...all, stop]));
    return stop.key;
  }

  /** Phase 1 smart order: stops from the school's students' home addresses, farthest first. */
  function suggest() {
    if (!schoolId) return setSuggestInfo("Choose the school first.");
    if (stops.length > 0 && !window.confirm("Replace the stops you have with the suggestion?")) return;
    setSuggestInfo(null);
    startSuggest(async () => {
      const r = await suggestRouteStops(schoolId, runType, includeRouted);
      if (r.error) return setSuggestInfo(r.error);
      const pickup = runType === "school_am" ? "pickup" : "dropoff";
      const next: Stop[] = r.stops.map((x) => ({
        key: newKey(),
        name: x.name,
        address: x.address,
        lat: x.lat,
        lng: x.lng,
        time: "",
        kind: pickup,
        radius: 80,
        students: x.students,
      }));
      // The school closes the morning run and opens the evening one.
      if (school && school.lat != null && school.lng != null) {
        const schoolStop: Stop = {
          key: newKey(),
          name: school.label,
          address: school.address ?? "",
          lat: school.lat,
          lng: school.lng,
          time: "",
          kind: "school",
          radius: 120,
          students: [],
        };
        if (runType === "school_am") next.push(schoolStop);
        else next.unshift(schoolStop);
      }
      setStops(next);
      const n = r.stops.reduce((sum, x) => sum + x.students.length, 0);
      const extra = [
        r.noAddress > 0 ? `${r.noAddress} without a located address` : "",
        r.alreadyRouted > 0 ? `${r.alreadyRouted} already on another ${runType === "school_am" ? "AM" : "PM"} route` : "",
      ].filter(Boolean);
      setSuggestInfo(
        r.stops.length === 0
          ? `No students to place.${extra.length ? ` Left out: ${extra.join("; ")}.` : ""}`
          : `${r.stops.length} stop${r.stops.length === 1 ? "" : "s"} for ${n} student${n === 1 ? "" : "s"}, ${
              runType === "school_am" ? "farthest from the school first" : "nearest to the school first"
            }.${extra.length ? ` Left out: ${extra.join("; ")}.` : ""} Review the order and edit what is not right.`,
      );
    });
  }

  function addSchoolStop() {
    if (!school || school.lat == null || school.lng == null) return;
    addStop(
      { name: school.label, address: school.address ?? "", lat: school.lat, lng: school.lng, kind: "school" },
      runType === "school_pm",
    );
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    setStops((all) => {
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function fillTimes() {
    const start = (formRef.current?.elements.namedItem("scheduled_start_time") as HTMLInputElement | null)?.value ?? "";
    const m = /^(\d{2}):(\d{2})/.exec(start);
    if (!m) return setNote("Set the route's start time first.");
    const t0 = Number(m[1]) * 60 + Number(m[2]);
    setNote(null);
    setStops((all) => all.map((s, i) => ({ ...s, time: hhmm(t0 + i * Math.max(1, gap)) })));
  }

  const send = (fd: FormData) => {
    fd.set("stops_json", JSON.stringify(stops.map((s) => ({ ...s, students: s.students.map((x) => x.id) }))));
    action(fd);
  };

  return (
    <form ref={formRef} action={send} className="max-w-4xl">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">1 · Details</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Route name</label>
            <input name="name" required maxLength={120} placeholder="Route 12 — Lincoln AM" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Run</label>
              <select
                name="route_type"
                value={runType}
                onChange={(e) => setRunType(e.target.value as "school_am" | "school_pm")}
                className={inputClass}
              >
                <option value="school_am">AM — to school</option>
                <option value="school_pm">PM — home</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Start time</label>
              <TimeInput name="scheduled_start_time" format={timeFormat} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">School</label>
            <select name="school_site_id" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium">Service days</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {WEEKDAYS.map((d) => (
                <label key={d.n} className="flex items-center gap-1.5">
                  <input type="checkbox" name="service_days" value={d.n} defaultChecked={d.n <= 5} />
                  {d.short}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold">2 · Crew</h2>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Driver</label>
            <select name="driver_id" defaultValue="" className={inputClass}>
              <option value="">Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Bus</label>
            <select name="vehicle_id" defaultValue="" className={inputClass}>
              <option value="">Unassigned</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <MonitorPicker monitors={monitors} label="Bus aide (optional)" />
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">3 · Stops</h2>
            <p className="text-xs text-muted">
              {stops.length} stop{stops.length === 1 ? "" : "s"}
              {stops.length > 1 ? ` · about ${(lengthKm * 0.621371).toFixed(1)} mi in a straight line` : ""}
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-accent/50 bg-accent/5 p-3">
            <button
              type="button"
              onClick={suggest}
              disabled={suggesting || !schoolId}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {suggesting ? "Working it out…" : "Suggest stops from students' addresses"}
            </button>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={includeRouted} onChange={(e) => setIncludeRouted(e.target.checked)} />
              Include students already on a {runType === "school_am" ? "morning" : "afternoon"} route (saving moves them to this one)
            </label>
            <p className="mt-2 text-xs text-muted">
              {suggestInfo ?? "Uses each student's home address: the farthest from the school is picked up first. You review it before saving."}
            </p>
          </div>
          <AddressAutocompleteInput
            name="stop_search"
            label="Search an address"
            placeholder="Type an address to add a stop"
            resetOnPick
            onPick={(p) => addStop({ name: p.address.split(",")[0] || "Stop", address: p.address, lat: p.lat, lng: p.lon })}
          />
          <p className="text-xs text-muted">Use the suggestion above to build the list from the students&apos; home addresses, or add stops one by one in the order the bus will run them. Reorder with the arrows.</p>
          {school && school.lat != null && !hasSchoolStop && (
            <button
              type="button"
              onClick={addSchoolStop}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent"
            >
              {runType === "school_am" ? "Add the school as the last stop" : "Add the school as the first stop"}
            </button>
          )}

          <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {stops.map((s, i) => (
              <li key={s.key} className="bg-background px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                      s.kind === "school" ? "bg-[#bd5b26]" : "bg-[#2c6c99]"
                    }`}
                  >
                    {s.kind === "school" ? "S" : i + 1}
                  </span>
                  <input
                    value={s.name}
                    onChange={(e) => patch(s.key, { name: e.target.value })}
                    maxLength={120}
                    aria-label={`Stop ${i + 1} name`}
                    className="min-w-[160px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                  <input
                    type="time"
                    value={s.time}
                    onChange={(e) => patch(s.key, { time: e.target.value })}
                    aria-label={`Stop ${i + 1} time`}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                  <select
                    value={s.kind}
                    onChange={(e) => patch(s.key, { kind: e.target.value as Stop["kind"] })}
                    aria-label={`Stop ${i + 1} type`}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="pickup">Pick-up</option>
                    <option value="dropoff">Drop-off</option>
                    <option value="school">School</option>
                  </select>
                  <input
                    type="number"
                    min={20}
                    max={500}
                    value={s.radius}
                    onChange={(e) => patch(s.key, { radius: Number(e.target.value) })}
                    aria-label={`Stop ${i + 1} radius in meters`}
                    title="Arrival radius (m)"
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                  <span className="flex items-center">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="px-1.5 text-muted hover:text-foreground disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label="Move down" className="px-1.5 text-muted hover:text-foreground disabled:opacity-30">
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setStops((all) => all.filter((x) => x.key !== s.key))}
                      aria-label="Remove stop"
                      className="px-1.5 text-danger"
                    >
                      ×
                    </button>
                  </span>
                </div>
                {(s.address || s.students.length > 0) && (
                  <p className="mt-1 truncate pl-8 text-xs text-muted">
                    {s.address}
                    {s.students.length > 0 && (
                      <>
                        {s.address ? " · " : ""}
                        <span className="font-medium text-foreground">{s.students.length}</span> {s.students.length === 1 ? "student" : "students"}:{" "}
                        {s.students.map((x) => x.name).join(", ")}
                      </>
                    )}
                  </p>
                )}
              </li>
            ))}
            {stops.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted">No stops yet. Search an address above.</li>
            )}
          </ol>

          {stops.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" onClick={fillTimes} className="rounded-lg border border-border px-3 py-1.5 transition hover:border-accent">
                Fill the times
              </button>
              <label className="flex items-center gap-1.5 text-muted">
                one stop every
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={gap}
                  onChange={(e) => setGap(Number(e.target.value))}
                  className="w-14 rounded-md border border-border bg-background px-2 py-1"
                />
                min from the start time
              </label>
            </div>
          )}
          {note && <p className="text-xs text-danger">{note}</p>}
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold">4 · Save</h2>
          <p className="text-xs text-muted">
            A draft stays out of the drivers&apos; app until you publish it. After saving, assign the students to the stops on the
            route page.
          </p>
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="publish"
              value="1"
              disabled={pending || stops.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save and publish"}
            </button>
            <button
              type="submit"
              name="publish"
              value="0"
              disabled={pending || stops.length === 0}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60"
            >
              Save as draft
            </button>
          </div>
        </section>
      </div>

    </form>
  );
}
