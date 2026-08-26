"use client";

import { useActionState, useEffect, useState } from "react";
import { generateCode, type GenerateState } from "./actions";

const initialState: GenerateState = { error: null, code: null, expiresAt: null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function GenerateForm() {
  const [state, formAction, pending] = useActionState(generateCode, initialState);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!state.expiresAt) return;
    const expiresAt = new Date(state.expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.expiresAt]);

  if (state.code) {
    const expired = secondsLeft === 0;
    const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
    const ss = secondsLeft !== null ? secondsLeft % 60 : 0;

    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">Share this code with your tax preparer:</p>
        <p
          className="my-4 rounded-lg bg-[var(--code-bg)] px-4 py-4 text-center font-mono text-3xl tracking-[0.3em] text-[var(--code-foreground)]"
          aria-live="polite"
        >
          {state.code}
        </p>
        <p className={`text-center text-sm ${expired ? "text-danger" : "text-muted"}`}>
          {expired
            ? "This code has expired."
            : `Expires in ${mm}:${ss.toString().padStart(2, "0")}`}
        </p>
        <p className="mt-4 text-xs text-muted">
          Usable up to 2 times. Your preparer enters it at{" "}
          <span className="font-medium text-foreground">controlmiles.com/portal/verify</span>{" "}
          to view a read-only summary — no login required on their end.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_date" className="mb-1.5 block text-sm font-medium">
            From
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            max={todayIso()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="mb-1.5 block text-sm font-medium">
            To
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            max={todayIso()}
            defaultValue={todayIso()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

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
        {pending ? "Generating…" : "Generate code"}
      </button>
    </form>
  );
}
