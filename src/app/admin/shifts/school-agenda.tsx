"use client";

// The school's big agenda (2026-10-26): every class of the week with its time,
// student, instructor and car, the hours the school is closed (no instructor
// teaches, or blocked hours such as lunch), and a click on an empty spot to add
// a class. Several classes can be added one after another without closing it.
// A class can be dragged to another time or day, or moved / cancelled from its
// detail card (the card is also the way to move on a touch screen). The same
// rules as the client's booking apply: an instructor or a car cannot be in two
// classes at once, and blocked hours and days off cannot be booked.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgendaGrid, fmtMinutes, type AgendaItem, type AgendaShade } from "@/components/agenda-grid";
import {
  addAgendaClass,
  cancelAgendaClass,
  deleteAvailability,
  deleteBlockedHours,
  getAgendaWeek,
  moveAgendaClass,
  updateAvailability,
  updateBlockedHours,
  type AgendaAvailability,
  type AgendaBlock,
  type AgendaWeek,
} from "./agenda-actions";

type Option = { id: string; label: string };
type StudentOption = Option & { minutes: number };

const field =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const btn = "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-border-strong disabled:opacity-50";
const primary = "rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (date: string) => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
};
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const rangeLabel = (dates: string[]) => {
  const f = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return dates.length === 1
    ? new Date(`${dates[0]}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : `${f(dates[0])} – ${f(dates[dates.length - 1])}`;
};

export function SchoolAgenda({
  orgId,
  drivers,
  vehicles,
  students,
  timeFormat,
  today,
  initialDate,
  /** When set, picking a spot also reports it (used by the Add class form). */
  onPick,
}: {
  orgId: string;
  drivers: Option[];
  vehicles: Option[];
  students: StudentOption[];
  timeFormat: "12h" | "24h";
  today: string;
  initialDate?: string;
  onPick?: (p: { date: string; start: string }) => void;
}) {
  const [anchor, setAnchor] = useState(initialDate ?? today);
  const [view, setView] = useState<"week" | "day">("week");
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<AgendaWeek | null>(null);
  const [banner, setBanner] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ date: string; start: number } | null>(null);
  // A click on a shaded spot (lunch / closed hours): opens a card to change or remove it.
  const [shadeSel, setShadeSel] = useState<{ shade: AgendaShade; minute: number } | null>(null);

  const dates = useMemo(() => {
    if (view === "day") return [anchor];
    const m = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(m, i));
  }, [anchor, view]);

  // Reload after any change: bumping the tick re-runs the fetch below.
  const [tick, setTick] = useState(0);
  const load = useCallback(async () => setTick((t) => t + 1), []);
  const key = `${dates[0]}|${dates.length}|${tick}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== key;
  useEffect(() => {
    let stale = false;
    void getAgendaWeek(orgId, dates[0], dates.length).then((r) => {
      if (stale) return;
      setLoadedKey(key);
      if ("error" in r) setBanner({ kind: "error", text: r.error });
      else setData(r);
    });
    return () => {
      stale = true;
    };
  }, [orgId, dates, key]);

  const driverName = useMemo(() => new Map(drivers.map((d) => [d.id, d.label])), [drivers]);
  const carName = useMemo(() => new Map(vehicles.map((v) => [v.id, v.label])), [vehicles]);
  const studentName = useMemo(() => new Map(students.map((s) => [s.id, s.label])), [students]);

  const blocks = useMemo(
    () => (data?.blocks ?? []).filter((b) => b.status !== "cancelled" && (!filter || b.driver_id === filter)),
    [data, filter],
  );

  // Visible hours: 7 AM to 7 PM, widened to fit anything outside that.
  const { startMin, endMin } = useMemo(() => {
    let lo = 7 * 60;
    let hi = 19 * 60;
    for (const b of data?.blocks ?? []) {
      lo = Math.min(lo, toMin(b.start_time));
      hi = Math.max(hi, toMin(b.end_time));
    }
    for (const a of data?.availability ?? []) {
      lo = Math.min(lo, toMin(a.start_time));
      hi = Math.max(hi, toMin(a.end_time));
    }
    return { startMin: Math.max(0, Math.floor(lo / 60) * 60), endMin: Math.min(24 * 60, Math.ceil(hi / 60) * 60) };
  }, [data]);

  const items: AgendaItem[] = useMemo(
    () =>
      blocks.map((b) => {
        const who = b.student_id ? (studentName.get(b.student_id) ?? "Student") : b.note || "Class";
        const parts = [
          b.driver_id ? (driverName.get(b.driver_id) ?? "Instructor") : "No instructor (open)",
          b.vehicle_id ? carName.get(b.vehicle_id) : null,
        ].filter(Boolean);
        return {
          id: b.id,
          date: b.block_date,
          start: toMin(b.start_time),
          end: toMin(b.end_time),
          title: who,
          subtitle: parts.join(" · "),
          tone: b.status === "done" ? "done" : b.status === "in_progress" ? "mine" : "class",
          draggable: b.status === "scheduled",
          clickable: true,
        };
      }),
    [blocks, studentName, driverName, carName],
  );

  const shades: AgendaShade[] = useMemo(() => {
    if (!data) return [];
    const out: AgendaShade[] = [];
    const hasAvail = data.availability.length > 0;
    for (const date of dates) {
      const dow = weekdayOf(date);
      if (hasAvail) {
        const wins = data.availability
          .filter((a) => a.weekday === dow && (!filter || a.instructor_id === filter))
          .filter((a) => !data.timeOff.some((t) => t.instructor_id === a.instructor_id && date >= t.date_from && date <= t.date_to))
          .map((a) => [toMin(a.start_time), toMin(a.end_time)] as const)
          .sort((x, y) => x[0] - y[0]);
        let cursor = startMin;
        for (const [s, e] of wins) {
          if (s > cursor) out.push({ date, start: cursor, end: s, kind: "closed", source: { type: "availability" } });
          cursor = Math.max(cursor, e);
        }
        if (cursor < endMin)
          out.push({ date, start: cursor, end: endMin, kind: "closed", label: wins.length === 0 ? "Closed" : undefined, source: { type: "availability" } });
      }
      // The school's lesson hours: nothing is booked online outside them.
      if (data.hours.open && data.hours.close) {
        out.push({ date, start: startMin, end: toMin(data.hours.open), kind: "closed", source: { type: "hours" } });
        out.push({ date, start: toMin(data.hours.close), end: endMin, kind: "closed", source: { type: "hours" } });
      }
      for (const h of data.blocked) {
        if (h.weekday !== null && h.weekday !== dow) continue;
        if (h.on_date !== null && h.on_date !== date) continue;
        if (filter && h.instructor_id && h.instructor_id !== filter) continue;
        const who = h.instructor_id && !filter ? ` · ${driverName.get(h.instructor_id) ?? ""}` : "";
        out.push({ date, start: toMin(h.start_time), end: toMin(h.end_time), kind: "break", label: `${h.label || "Blocked"}${who}`, source: { type: "blocked", id: h.id } });
      }
    }
    return out;
  }, [data, dates, filter, startMin, endMin, driverName]);

  const sel = selected ? (data?.blocks.find((b) => b.id === selected) ?? null) : null;

  async function onDrop(item: AgendaItem, date: string, minute: number) {
    const b = data?.blocks.find((x) => x.id === item.id);
    if (!b) return;
    setBanner(null);
    const r = await moveAgendaClass({
      blockId: b.id,
      date,
      start: toHHMM(minute),
      driverId: b.driver_id,
      vehicleId: b.vehicle_id,
    });
    if (r.error) setBanner({ kind: "error", text: r.error });
    else setBanner({ kind: "ok", text: `Moved to ${date} at ${fmtMinutes(minute, timeFormat)}.` });
    await load();
  }

  const step = (n: number) => setAnchor((a) => addDays(a, view === "week" ? 7 * n : n));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => step(-1)} aria-label="Previous">
          ←
        </button>
        <button type="button" className={btn} onClick={() => setAnchor(today)}>
          Today
        </button>
        <button type="button" className={btn} onClick={() => step(1)} aria-label="Next">
          →
        </button>
        <span className="px-1 text-sm font-medium">{rangeLabel(dates)}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${field} w-auto`} aria-label="Instructor">
            <option value="">All instructors</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-border text-sm">
            {(["week", "day"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-accent text-accent-foreground" : "bg-surface hover:bg-background"}`}
              >
                {v === "week" ? "Week" : "Day"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {banner && (
        <p role={banner.kind === "error" ? "alert" : "status"} className={`text-sm ${banner.kind === "error" ? "text-danger" : "text-success"}`}>
          {banner.text}
        </p>
      )}

      {/* Above the grid, so it is in view right after a click on the calendar. */}
      {draft && (
        <NewClassCard
          key={`${draft.date}-${draft.start}`}
          orgId={orgId}
          drivers={drivers}
          vehicles={vehicles}
          students={students}
          date={draft.date}
          start={draft.start}
          defaultDriver={filter}
          timeFormat={timeFormat}
          onClose={() => setDraft(null)}
          onAdded={async (endMinute, date) => {
            setBanner({ kind: "ok", text: "Class added." });
            await load();
            // Ready for the next one right after this class.
            setDraft({ date, start: endMinute });
          }}
        />
      )}

      {shadeSel && data && (
        <ShadeCard
          key={`${shadeSel.shade.date}-${shadeSel.minute}-${shadeSel.shade.source?.type}`}
          shade={shadeSel.shade}
          minute={shadeSel.minute}
          data={data}
          filter={filter}
          driverName={driverName}
          timeFormat={timeFormat}
          onClose={() => setShadeSel(null)}
          onAddClass={() => {
            setDraft({ date: shadeSel.shade.date, start: shadeSel.minute });
            setShadeSel(null);
          }}
          onChanged={async (text) => {
            setBanner({ kind: "ok", text });
            setShadeSel(null);
            await load();
          }}
        />
      )}

      {sel && (
        <BlockCard
          key={sel.id}
          block={sel}
          drivers={drivers}
          vehicles={vehicles}
          studentName={sel.student_id ? (studentName.get(sel.student_id) ?? "Student") : null}
          timeFormat={timeFormat}
          onClose={() => setSelected(null)}
          onChanged={async (text) => {
            setBanner(text ? { kind: "ok", text } : null);
            setSelected(null);
            await load();
          }}
        />
      )}

      <div className={loading ? "opacity-60 transition" : "transition"}>
        <AgendaGrid
          stepMin={30}
          dates={dates}
          startMin={startMin}
          endMin={endMin}
          items={items}
          shades={shades}
          today={today}
          timeFormat={timeFormat}
          minColPx={view === "day" ? 320 : 84}
          onShadeClick={(shade, minute) => {
            setSelected(null);
            setDraft(null);
            setBanner(null);
            setShadeSel({ shade, minute });
          }}
          onEmptyClick={(date, minute) => {
            setShadeSel(null);
            setSelected(null);
            setBanner(null);
            setDraft({ date, start: minute });
            onPick?.({ date, start: toHHMM(minute) });
          }}
          onItemClick={(it) => {
            setShadeSel(null);
            setDraft(null);
            setBanner(null);
            setSelected(it.id);
          }}
          onDropItem={onDrop}
        />
      </div>

      <p className="text-xs text-muted">
        Click an empty time to add a class, or a shaded spot to change or remove it. Drag a class to move it. Shaded: no instructor teaches, or the hours are blocked.{" "}
        <Link href="/admin/shifts?tab=availability" className="text-accent hover:underline">
          Manage availability and blocked hours
        </Link>
      </p>

    </div>
  );
}

function NewClassCard({
  orgId,
  drivers,
  vehicles,
  students,
  date: initialDate,
  start: initialStart,
  defaultDriver,
  timeFormat,
  onClose,
  onAdded,
}: {
  orgId: string;
  drivers: Option[];
  vehicles: Option[];
  students: StudentOption[];
  date: string;
  start: number;
  defaultDriver: string;
  timeFormat: "12h" | "24h";
  onClose: () => void;
  onAdded: (endMinute: number, date: string) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [driverId, setDriverId] = useState(defaultDriver || drivers[0]?.id || "");
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(toHHMM(initialStart));
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const end = toMin(start) + minutes;

  async function save() {
    setError(null);
    if (end > 24 * 60 - 1) return setError("The class must end the same day.");
    setBusy(true);
    const r = await addAgendaClass({
      orgId,
      driverId: driverId || null,
      vehicleId: vehicleId || null,
      date,
      start,
      end: toHHMM(end),
      studentId: studentId || null,
      note,
    });
    setBusy(false);
    if (r.error) return setError(r.error);
    await onAdded(end, date);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          New class · {date} · {fmtMinutes(toMin(start), timeFormat)}–{fmtMinutes(end % (24 * 60), timeFormat)}
        </h3>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Close
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">
          Student
          <select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              const s = students.find((x) => x.id === e.target.value);
              if (s) setMinutes(s.minutes);
            }}
            className={`${field} mt-1`}
          >
            <option value="">No student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Instructor
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={`${field} mt-1`}>
            <option value="">No instructor (open: an instructor can take it)</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Car
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={`${field} mt-1`}>
            <option value="">Unassigned</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Length (minutes)
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(15, Number(e.target.value) || 60))}
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Note (optional)
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={busy} className={primary}>
          {busy ? "Adding…" : "Add class"}
        </button>
        <button type="button" onClick={onClose} className={btn}>
          Done
        </button>
      </div>
    </div>
  );
}

// Card for a shaded spot: lunch / blocked hours can be edited or removed, and the
// closed hours outside an instructor's availability can be changed or removed.
function ShadeCard({
  shade,
  minute,
  data,
  filter,
  driverName,
  timeFormat,
  onClose,
  onAddClass,
  onChanged,
}: {
  shade: AgendaShade;
  minute: number;
  data: AgendaWeek;
  filter: string;
  driverName: Map<string, string>;
  timeFormat: "12h" | "24h";
  onClose: () => void;
  onAddClass: () => void;
  onChanged: (text: string) => Promise<void>;
}) {
  const src = shade.source;
  const blocked = src?.type === "blocked" ? (data.blocked.find((b) => b.id === src.id) ?? null) : null;
  const [label, setLabel] = useState(blocked?.label ?? "");
  const [start, setStart] = useState(blocked?.start_time.slice(0, 5) ?? "");
  const [end, setEnd] = useState(blocked?.end_time.slice(0, 5) ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dow = weekdayOf(shade.date);
  const windows = data.availability
    .filter((a) => a.weekday === dow && (!filter || a.instructor_id === filter))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  async function run(fn: () => Promise<{ error: string | null }>, done: string) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) return setError(r.error);
    await onChanged(done);
  }

  const range = `${fmtMinutes(shade.start, timeFormat)}–${fmtMinutes(shade.end, timeFormat)}`;
  const title = blocked ? blocked.label || "Blocked hours" : src?.type === "hours" ? "Outside the school's lesson hours" : "Closed: no instructor teaches";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted">
            {shade.date} · {range}
            {blocked?.instructor_id ? ` · ${driverName.get(blocked.instructor_id) ?? "Instructor"}` : blocked ? " · whole school" : ""}
          </p>
          {blocked && (
            <p className="mt-0.5 text-xs text-muted">
              {blocked.on_date ? "Only this date." : blocked.weekday === null ? "Every day." : "Every week on this weekday."} Changes apply to all of its days.
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {blocked && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              Name
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-muted">
              From
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-muted">
              To
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className={primary}
              onClick={() => run(() => updateBlockedHours({ id: blocked.id, start, end, label }), "Blocked hours updated.")}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {!confirmRemove ? (
              <button type="button" className={`${btn} text-danger`} onClick={() => setConfirmRemove(true)}>
                Remove
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm">
                Remove these blocked hours?
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => deleteBlockedHours(blocked.id), "Blocked hours removed.")}
                  className="rounded-lg border border-danger px-3 py-1.5 text-danger"
                >
                  Yes, remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className={btn}>
                  Keep
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {src?.type === "availability" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">
            Students book only inside an instructor&apos;s hours. Change or remove a window to move this closed time
            {windows.length === 0 ? "; none is set for this weekday." : "."}
          </p>
          {windows.map((a) => (
            <AvailabilityRow key={a.id} a={a} name={driverName.get(a.instructor_id) ?? "Instructor"} busy={busy} run={run} />
          ))}
          <Link href="/admin/shifts?tab=availability" className="inline-block text-sm text-accent hover:underline">
            Add availability
          </Link>
        </div>
      )}

      {src?.type === "hours" && (
        <p className="mt-3 text-sm text-muted">
          These are the school&apos;s lesson hours.{" "}
          <Link href="/admin/students" className="text-accent hover:underline">
            Change the school hours
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-3">
        <button type="button" className={btn} onClick={onAddClass}>
          Add a class at {fmtMinutes(minute, timeFormat)} anyway
        </button>
      </div>
    </div>
  );
}

function AvailabilityRow({
  a,
  name,
  busy,
  run,
}: {
  a: AgendaAvailability;
  name: string;
  busy: boolean;
  run: (fn: () => Promise<{ error: string | null }>, done: string) => Promise<void>;
}) {
  const [start, setStart] = useState(a.start_time.slice(0, 5));
  const [end, setEnd] = useState(a.end_time.slice(0, 5));
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-24 font-medium">{name}</span>
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} w-auto`} aria-label="From" />
      <span className="text-muted">–</span>
      <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${field} w-auto`} aria-label="To" />
      <button
        type="button"
        disabled={busy}
        className={btn}
        onClick={() => run(() => updateAvailability({ id: a.id, start, end }), "Availability updated.")}
      >
        Save
      </button>
      {!confirm ? (
        <button type="button" className={`${btn} text-danger`} onClick={() => setConfirm(true)}>
          Remove
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => deleteAvailability(a.id), "Availability removed.")}
            className="rounded-lg border border-danger px-3 py-1.5 text-danger"
          >
            Yes, remove
          </button>
          <button type="button" onClick={() => setConfirm(false)} className={btn}>
            Keep
          </button>
        </span>
      )}
    </div>
  );
}

function BlockCard({
  block,
  drivers,
  vehicles,
  studentName,
  timeFormat,
  onClose,
  onChanged,
}: {
  block: AgendaBlock;
  drivers: Option[];
  vehicles: Option[];
  studentName: string | null;
  timeFormat: "12h" | "24h";
  onClose: () => void;
  onChanged: (text: string | null) => Promise<void>;
}) {
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(block.block_date);
  const [start, setStart] = useState(block.start_time.slice(0, 5));
  const [driverId, setDriverId] = useState(block.driver_id ?? "");
  const [vehicleId, setVehicleId] = useState(block.vehicle_id ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scheduled = block.status === "scheduled";
  const driver = block.driver_id ? (drivers.find((d) => d.id === block.driver_id)?.label ?? "Instructor") : "No instructor (open)";
  const car = vehicles.find((v) => v.id === block.vehicle_id)?.label;

  async function move() {
    setBusy(true);
    setError(null);
    const r = await moveAgendaClass({ blockId: block.id, date, start, driverId: driverId || null, vehicleId: vehicleId || null });
    setBusy(false);
    if (r.error) return setError(r.error);
    await onChanged("Class moved.");
  }
  async function cancel() {
    setBusy(true);
    setError(null);
    const r = await cancelAgendaClass(block.id);
    setBusy(false);
    if (r.error) return setError(r.error);
    await onChanged("Class cancelled.");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{studentName ?? block.note ?? "Class"}</h3>
          <p className="text-sm text-muted">
            {block.block_date} · {fmtMinutes(toMin(block.start_time), timeFormat)}–{fmtMinutes(toMin(block.end_time), timeFormat)} · {driver}
            {car ? ` · ${car}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {block.status === "scheduled" ? "Scheduled" : block.status === "in_progress" ? "In class" : block.status === "cancelled" ? "Cancelled" : "Done"}
            {block.booked_via === "portal" ? " · booked online by the client" : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {scheduled && !moving && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => setMoving(true)}>
            Move
          </button>
          {!confirmCancel ? (
            <button type="button" className={`${btn} text-danger`} onClick={() => setConfirmCancel(true)}>
              Cancel class
            </button>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              Cancel this class?
              <button type="button" disabled={busy} onClick={cancel} className="rounded-lg border border-danger px-3 py-1.5 text-danger">
                {busy ? "Cancelling…" : "Yes, cancel"}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className={btn}>
                Keep
              </button>
            </span>
          )}
        </div>
      )}

      {scheduled && moving && (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-muted">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-muted">
              Start
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-muted">
              Instructor
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={`${field} mt-1`}>
                <option value="">No instructor (open)</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Car
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={`${field} mt-1`}>
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={move} className={primary}>
              {busy ? "Moving…" : "Move class"}
            </button>
            <button type="button" onClick={() => setMoving(false)} className={btn}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A calendar button that opens the agenda in a large dialog (used in the Add class form). */
export function AgendaButton(props: React.ComponentProps<typeof SchoolAgenda> & { label?: string }) {
  const { label = "Open agenda", ...rest } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition hover:border-accent"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        Agenda
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-6xl rounded-2xl border border-border bg-surface p-0 text-left font-normal normal-case text-foreground shadow-2xl backdrop:bg-black/40"
      >
        {open && (
          <div className="flex max-h-[92vh] flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-base font-semibold">Agenda</h2>
              <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md p-1 text-muted hover:text-foreground">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <SchoolAgenda {...rest} />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
