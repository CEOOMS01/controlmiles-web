"use client";

import { useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);

  // BUG FIX (pedido explícito, 2026-09-09): assignDriver() se llamaba
  // dentro de startTransition sin capturar el resultado ni mostrar
  // nada -- un rechazo se convertía en una promesa no manejada, sin
  // ningún aviso visible al admin.
  function handleChange(driverId: string) {
    startTransition(async () => {
      const result = await assignDriver(vehicleId, driverId || null);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={currentDriverId ?? ""}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ArchiveButton({ vehicleId }: { vehicleId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveVehicle(vehicleId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleArchive}
        disabled={pending}
        className="text-xs text-danger transition hover:underline disabled:opacity-60"
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
