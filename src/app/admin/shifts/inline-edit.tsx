"use client";

// Edit buttons for every list on the Classes page (2026-11-21): the school can
// change what it saved instead of removing it and typing it again. Each one
// opens a small window over the page with the same fields as the form that
// created the item.

import { useState, type ReactNode } from "react";
import { updateAvailability, updateBlockedHours, updateTimeOff, moveAgendaClass } from "./agenda-actions";
import { updateShift, updateClassBlockNote } from "./actions";

type Option = { id: string; label: string };

const field =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const lbl = "block text-xs text-muted";
const btn = "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-border-strong disabled:opacity-50";
const primary = "rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50";

function EditDialog({
  title,
  onSave,
  children,
  linkClass = "text-xs text-accent hover:underline",
}: {
  title: string;
  /** Returns an error text, or null when it saved. */
  onSave: () => Promise<{ error: string | null }>;
  children: ReactNode;
  linkClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await onSave();
    setBusy(false);
    if (r.error) return setError(r.error);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={linkClass}>
        Edit
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-surface p-4 text-left text-sm shadow-xl">
            <h3 className="text-base font-semibold">{title}</h3>
            {children}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" disabled={busy} className={primary} onClick={save}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditAvailability({ id, start, end }: { id: string; start: string; end: string }) {
  const [s, setS] = useState(start.slice(0, 5));
  const [e, setE] = useState(end.slice(0, 5));
  return (
    <EditDialog title="Edit availability" onSave={() => updateAvailability({ id, start: s, end: e })}>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          From
          <input type="time" value={s} onChange={(x) => setS(x.target.value)} className={`${field} mt-1`} />
        </label>
        <label className={lbl}>
          To
          <input type="time" value={e} onChange={(x) => setE(x.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
    </EditDialog>
  );
}

export function EditBlockedHours({ id, label, start, end }: { id: string; label: string; start: string; end: string }) {
  const [name, setName] = useState(label);
  const [s, setS] = useState(start.slice(0, 5));
  const [e, setE] = useState(end.slice(0, 5));
  return (
    <EditDialog title="Edit blocked hours" onSave={() => updateBlockedHours({ id, start: s, end: e, label: name })}>
      <label className={lbl}>
        Name
        <input value={name} onChange={(x) => setName(x.target.value)} maxLength={60} className={`${field} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          From
          <input type="time" value={s} onChange={(x) => setS(x.target.value)} className={`${field} mt-1`} />
        </label>
        <label className={lbl}>
          To
          <input type="time" value={e} onChange={(x) => setE(x.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
    </EditDialog>
  );
}

export function EditTimeOff({ id, from, to, note }: { id: string; from: string; to: string; note: string | null }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [n, setN] = useState(note ?? "");
  return (
    <EditDialog title="Edit days off" onSave={() => updateTimeOff({ id, from: f, to: t, note: n })}>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          From
          <input type="date" value={f} onChange={(x) => setF(x.target.value)} className={`${field} mt-1`} />
        </label>
        <label className={lbl}>
          To
          <input type="date" value={t} onChange={(x) => setT(x.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <label className={lbl}>
        Note
        <input value={n} onChange={(x) => setN(x.target.value)} maxLength={120} className={`${field} mt-1`} />
      </label>
    </EditDialog>
  );
}

export function EditShift({
  id,
  start,
  end,
  vehicleId,
  notes,
  vehicles,
}: {
  id: string;
  start: string;
  end: string;
  vehicleId: string | null;
  notes: string | null;
  vehicles: Option[];
}) {
  const [s, setS] = useState(start.slice(0, 5));
  const [e, setE] = useState(end.slice(0, 5));
  const [v, setV] = useState(vehicleId ?? "");
  const [n, setN] = useState(notes ?? "");
  return (
    <EditDialog title="Edit weekly class" onSave={() => updateShift({ id, start: s, end: e, vehicleId: v || null, notes: n })}>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          From
          <input type="time" value={s} onChange={(x) => setS(x.target.value)} className={`${field} mt-1`} />
        </label>
        <label className={lbl}>
          To
          <input type="time" value={e} onChange={(x) => setE(x.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <label className={lbl}>
        Vehicle
        <select value={v} onChange={(x) => setV(x.target.value)} className={`${field} mt-1`}>
          <option value="">No vehicle</option>
          {vehicles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        Notes
        <input value={n} onChange={(x) => setN(x.target.value)} maxLength={200} className={`${field} mt-1`} />
      </label>
      <p className="text-xs text-muted">Applies from the next days on; classes already created keep their own time.</p>
    </EditDialog>
  );
}

/** Day tab: move a class (date, time, instructor, car) and change its note. */
export function EditClass({
  blockId,
  date,
  start,
  driverId,
  vehicleId,
  note,
  drivers,
  vehicles,
}: {
  blockId: string;
  date: string;
  start: string;
  driverId: string | null;
  vehicleId: string | null;
  note: string | null;
  drivers: Option[];
  vehicles: Option[];
}) {
  const [d, setD] = useState(date);
  const [s, setS] = useState(start.slice(0, 5));
  const [dr, setDr] = useState(driverId ?? "");
  const [v, setV] = useState(vehicleId ?? "");
  const [n, setN] = useState(note ?? "");
  return (
    <EditDialog
      title="Edit class"
      onSave={async () => {
        if ((note ?? "") !== n.trim()) {
          const r = await updateClassBlockNote(blockId, n);
          if (r.error) return r;
        }
        return moveAgendaClass({ blockId, date: d, start: s, driverId: dr || null, vehicleId: v || null });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          Date
          <input type="date" value={d} onChange={(x) => setD(x.target.value)} className={`${field} mt-1`} />
        </label>
        <label className={lbl}>
          Start
          <input type="time" value={s} onChange={(x) => setS(x.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <label className={lbl}>
        Instructor
        <select value={dr} onChange={(x) => setDr(x.target.value)} className={`${field} mt-1`}>
          <option value="">No instructor (open)</option>
          {drivers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        Vehicle
        <select value={v} onChange={(x) => setV(x.target.value)} className={`${field} mt-1`}>
          <option value="">No vehicle</option>
          {vehicles.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={lbl}>
        Note
        <input value={n} onChange={(x) => setN(x.target.value)} maxLength={200} className={`${field} mt-1`} />
      </label>
    </EditDialog>
  );
}
