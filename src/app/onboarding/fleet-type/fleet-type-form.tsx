"use client";

import { useActionState } from "react";
import { FleetTypePicker } from "@/components/fleet-type-picker";
import { chooseFleetType, type FleetTypeState } from "./actions";

const initialState: FleetTypeState = { error: null };

export function FleetTypeForm() {
  const [state, formAction, pending] = useActionState(chooseFleetType, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FleetTypePicker />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
