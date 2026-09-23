"use client";

// Team+Vehicles unification (explicit user request, 2026-09-23): the
// inverse of vehicles/vehicle-row-actions.tsx's AssignDriverSelect --
// picks a vehicle FOR a driver, from a driver row, instead of a driver
// for a vehicle from a vehicle row. Calls setDriverVehicle so a
// reassignment clears the driver's previous vehicle in the same action
// (see that function's own comment for why that isn't automatic).

import { useState, useTransition } from "react";
import { setDriverVehicle } from "../vehicles/actions";

type VehicleOption = { id: string; label: string; assignedToDriverId: string | null };

export function DriverVehicleSelect({
  driverId,
  currentVehicleId,
  vehicles,
}: {
  driverId: string;
  currentVehicleId: string | null;
  vehicles: VehicleOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(vehicleId: string) {
    startTransition(async () => {
      const result = await setDriverVehicle(driverId, vehicleId || null, currentVehicleId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={currentVehicleId ?? ""}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {vehicles.map((v) => {
          const takenByOther = v.assignedToDriverId != null && v.assignedToDriverId !== driverId;
          return (
            <option key={v.id} value={v.id}>
              {v.label}
              {takenByOther ? " (assigned elsewhere)" : ""}
            </option>
          );
        })}
      </select>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
