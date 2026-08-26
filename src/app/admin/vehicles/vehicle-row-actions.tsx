"use client";

import { useTransition } from "react";
import { assignDriver, archiveVehicle } from "./actions";

type Driver = { id: string; label: string };

export function AssignDriverSelect({
  vehicleId,
  currentDriverId,
  drivers,
}: {
  vehicleId: string;
  currentDriverId: string | null;
  drivers: Driver[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={currentDriverId ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => assignDriver(vehicleId, e.target.value || null))
      }
      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60"
    >
      <option value="">Unassigned</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </select>
  );
}

export function ArchiveButton({ vehicleId }: { vehicleId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => archiveVehicle(vehicleId))}
      disabled={pending}
      className="text-xs text-danger transition hover:underline disabled:opacity-60"
    >
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
