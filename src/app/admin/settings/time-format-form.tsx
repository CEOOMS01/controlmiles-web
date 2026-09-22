"use client";

import { useActionState } from "react";
import { setTimeFormat, type TimeFormatState } from "./actions";

const initialState: TimeFormatState = { error: null, success: false };

export function TimeFormatForm({ currentFormat }: { currentFormat: "12h" | "24h" }) {
  const [state, formAction, pending] = useActionState(setTimeFormat, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-medium">Clock format</p>
      <p className="mt-1 text-sm text-muted">
        How times display across the app — route schedules, trip logs, and reports.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {(["12h", "24h"] as const).map((format) => (
          <label
            key={format}
            className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-sm transition ${
              currentFormat === format
                ? "border-accent bg-accent/10 font-semibold"
                : "border-border hover:border-accent/50"
            }`}
          >
            <input
              type="radio"
              name="time_format"
              value={format}
              defaultChecked={currentFormat === format}
              disabled={pending}
              className="mr-2"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            {format === "12h" ? "12-hour — 2:30 PM" : "24-hour — 14:30"}
          </label>
        ))}
      </div>

      {pending && <p className="mt-2 text-sm text-muted">Saving…</p>}
      {!pending && state.success && <p className="mt-2 text-sm text-success">Saved.</p>}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
