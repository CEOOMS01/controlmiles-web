"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null, sent: false };

// useSearchParams() requires a Suspense boundary around any client
// component that calls it, or Next.js fails the build -- split out so
// the boundary wraps only the bit that actually needs it.
function ExpiredLinkNotice() {
  const expired = useSearchParams().get("expired") === "1";
  if (!expired) return null;
  return (
    <p role="alert" className="mb-4 text-sm text-danger">
      That reset link expired or was already used. Request a new one below.
    </p>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the email on your fleet admin account and we&apos;ll send
            you a link to set a new password.
          </p>
        </div>

        {!state.sent && (
          <Suspense fallback={null}>
            <ExpiredLinkNotice />
          </Suspense>
        )}

        {state.sent ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <p>
              If an account exists for that email, we&apos;ve sent a link
              to reset your password. Check your inbox (and spam folder).
            </p>
            <p className="mt-3 text-xs text-muted">
              Can&apos;t click the link? The email also includes a code — go{" "}
              <Link href="/reset-password" className="text-accent hover:underline">
                enter your code
              </Link>{" "}
              instead.
            </p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
              {pending ? "Sending…" : "Send reset link"}
            </button>

            {/* Explicit user request, 2026-09-23: for someone who already
                requested a code, then lost/closed that page -- goes
                straight to the code-entry step instead of making them
                submit this form again. Submitting again would count as a
                fresh resetPasswordForEmail call against Supabase (another
                database write, another rate-limit hit) and would
                invalidate their still-valid code by generating a new
                one -- pure waste when the one they already have hasn't
                expired yet. */}
            <p className="text-center text-xs text-muted">
              Already have a code?{" "}
              <Link href="/reset-password" className="text-accent hover:underline">
                Enter it
              </Link>
            </p>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
