"use client";

import { useRef, useState, useTransition } from "react";
import { addRoute } from "./actions";
import { AddressAutocompleteInput } from "./address-autocomplete-input";

type Driver = { id: string; label: string };
type Vehicle = { id: string; label: string };

export function CreateRouteForm({
  orgId,
  drivers,
  vehicles,
}: {
  orgId: string;
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addRoute({ error: null, success: false }, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
      >
        Create route
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-3"
    >
      <input type="hidden" name="org_id" value={orgId} />
      <div className="sm:col-span-3">
        <label className="mb-1.5 block text-sm font-medium">Route name</label>
        <input
          name="name"
          type="text"
          required
          placeholder="Morning delivery loop"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <AddressAutocompleteInput name="origin" label="Origin" placeholder="Warehouse A" />
      <AddressAutocompleteInput
        name="destination"
        label="Destination"
        placeholder="Distribution center B"
      />
      <div>
        <label className="mb-1.5 block text-sm font-medium">Scheduled date</label>
        <input
          name="scheduled_date"
          type="date"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Driver</label>
        <select
          name="driver_id"
          defaultValue=""
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Unassigned</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Vehicle</label>
        <select
          name="vehicle_id"
          defaultValue=""
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
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
        <p role="alert" className="text-sm text-danger sm:col-span-3">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create route"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
