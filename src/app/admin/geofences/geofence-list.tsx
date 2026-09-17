"use client";

import { useState, useTransition } from "react";
import { setGeofenceActive, deleteGeofence } from "./actions";

type Row = {
  id: string;
  name: string;
  vehicleLabel: string;
  radius_meters: number;
  is_active: boolean;
};

export function GeofenceList({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-3 font-medium">Zone</th>
            <th className="px-4 py-3 font-medium">Vehicle</th>
            <th className="px-4 py-3 font-medium">Radius</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <GeofenceRow key={r.id} row={r} />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted">
                No zones yet — click the map above to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GeofenceRow({ row }: { row: Row }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(row.is_active);
  const [removed, setRemoved] = useState(false);

  function toggle() {
    const next = !active;
    startTransition(async () => {
      const result = await setGeofenceActive(row.id, next);
      if (result.error) {
        setError(result.error);
      } else {
        setActive(next);
        setError(null);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteGeofence(row.id);
      if (result.error) {
        setError(result.error);
      } else {
        setRemoved(true);
      }
    });
  }

  if (removed) return null;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-medium">{row.name}</td>
      <td className="px-4 py-3 text-muted">{row.vehicleLabel}</td>
      <td className="px-4 py-3 font-mono tabular-nums">{row.radius_meters.toLocaleString()} m</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            active ? "bg-accent/15 text-accent" : "bg-muted/20 text-muted"
          }`}
        >
          {active ? "Active" : "Paused"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-3">
            <button onClick={toggle} disabled={pending} className="text-xs text-accent transition hover:underline disabled:opacity-60">
              {active ? "Pause" : "Resume"}
            </button>
            <button onClick={remove} disabled={pending} className="text-xs text-danger transition hover:underline disabled:opacity-60">
              Delete
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </td>
    </tr>
  );
}
