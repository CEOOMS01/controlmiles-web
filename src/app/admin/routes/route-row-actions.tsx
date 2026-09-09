"use client";

import { useState, useTransition } from "react";
import { setRouteStatus, deleteDraftRoute, reassignRoute } from "./actions";

type Option = { id: string; label: string };

export function RouteRowActions({
  routeId,
  status,
  currentDriverId,
  currentVehicleId,
  drivers,
  vehicles,
}: {
  routeId: string;
  status: string;
  currentDriverId: string | null;
  currentVehicleId: string | null;
  drivers: Option[];
  vehicles: Option[];
}) {
  const [pending, startTransition] = useTransition();
  const [reassigning, setReassigning] = useState(false);
  const [driverId, setDriverId] = useState(currentDriverId ?? "");
  const [vehicleId, setVehicleId] = useState(currentVehicleId ?? "");
  const [error, setError] = useState<string | null>(null);

  if (status === "closed") {
    return <span className="text-xs text-muted">Locked</span>;
  }

  function submitReassign() {
    startTransition(async () => {
      const result = await reassignRoute(routeId, driverId || null, vehicleId || null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setReassigning(false);
    });
  }

  // BUG FIX (pedido explícito, 2026-09-09): Activate/Close/Delete
  // llamaban a sus acciones dentro de startTransition sin capturar el
  // resultado -- ahora esas tres acciones devuelven {error}, así que se
  // muestra con el mismo estado `error` que ya usa Reassign.
  function handleStatusChange(status: "active" | "closed") {
    startTransition(async () => {
      const result = await setRouteStatus(routeId, status);
      setError(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDraftRoute(routeId);
      setError(result.error);
    });
  }

  if (reassigning) {
    return (
      <div className="flex flex-col items-end gap-2 py-1">
        <div className="flex gap-2">
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
          >
            <option value="">Unassigned</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={submitReassign}
            disabled={pending}
            className="text-xs font-medium text-accent transition hover:underline disabled:opacity-60"
          >
            Save
          </button>
          <button
            onClick={() => {
              setReassigning(false);
              setDriverId(currentDriverId ?? "");
              setVehicleId(currentVehicleId ?? "");
              setError(null);
            }}
            className="text-xs font-medium text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setReassigning(true)}
          disabled={pending}
          className="text-xs font-medium text-accent transition hover:underline disabled:opacity-60"
        >
          Reassign
        </button>
        {status === "draft" && (
          <button
            onClick={() => handleStatusChange("active")}
            disabled={pending}
            className="text-xs font-medium text-accent transition hover:underline disabled:opacity-60"
          >
            Activate
          </button>
        )}
        <button
          onClick={() => handleStatusChange("closed")}
          disabled={pending}
          className="text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-60"
        >
          Close
        </button>
        {status === "draft" && (
          <button
            onClick={handleDelete}
            disabled={pending}
            className="text-xs font-medium text-danger transition hover:underline disabled:opacity-60"
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
