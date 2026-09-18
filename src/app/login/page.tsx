"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";
import { PasswordInput } from "@/components/password-input";

// useSearchParams() needs its own Suspense boundary -- split out so it
// wraps only the bit that reads the URL, not the whole page.
function PasswordResetNotice() {
  const reset = useSearchParams().get("reset") === "1";
  if (!reset) return null;
  return (
    <p role="status" className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm">
      Your password was updated. Sign in with your new password.
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Fleet admin sign in</h1>
          <p className="mt-2 text-sm text-muted">
            This dashboard is for fleet administrators. Driving for
            yourself or for a fleet? Get the ControlMiles mobile app
            instead.
          </p>
        </div>

        <Suspense fallback={null}>
          <PasswordResetNotice />
        </Suspense>

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

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput id="password" name="password" autoComplete="current-password" />
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
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
