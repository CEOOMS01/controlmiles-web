"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyResetCode, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null };

function ExpiredNotice() {
  const expired = useSearchParams().get("expired") === "1";
  if (!expired) return null;
  return (
    <p role="alert" className="mb-4 text-sm text-danger">
      That session expired before you set a new password. Verify your code again.
    </p>
  );
}

// Dedicated code-entry step (explicit user request, 2026-09-23) -- only
// ever verifies the code and opens a real recovery session, never asks
// for a new password itself. See actions.ts's own header comment for
// why this is deliberately a separate page from reset-password/new,
// not one combined form.
export default function ResetCodePage() {
  const [state, formAction, pending] = useActionState(verifyResetCode, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Enter your reset code</h1>
          <p className="mt-2 text-sm text-muted">
            Check your email for the 6-digit code we sent you.
          </p>
        </div>

        <Suspense fallback={null}>
          <ExpiredNotice />
        </Suspense>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
              Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
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
            {pending ? "Verifying…" : "Verify code"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Request a new code
          </Link>
        </p>
      </div>
    </main>
  );
}
