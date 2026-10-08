"use client";

// Small form helpers for the School pages: a form bound to a server action
// that shows its error and resets on success, and a row button for one-off
// actions (move, remove) with an optional confirmation.

import { useActionState, useEffect, useRef, useTransition } from "react";
import type { FormResult } from "./actions";

export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function ActionForm({
  action,
  submitLabel,
  className,
  children,
}: {
  action: (state: FormResult, formData: FormData) => Promise<FormResult>;
  submitLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        submitted.current = true;
        formAction(fd);
      }}
      className={className ?? "grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-3"}
    >
      {children}
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:col-span-3">
          {state.error}
        </p>
      )}
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function RowButton({
  onRun,
  label,
  confirmText,
  danger,
}: {
  onRun: () => Promise<FormResult>;
  label: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
          const r = await onRun();
          if (r.error) window.alert(r.error);
        });
      }}
      className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        danger ? "text-danger hover:bg-danger/10" : "text-muted hover:bg-background hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
