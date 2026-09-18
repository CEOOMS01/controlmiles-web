"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "./actions";
import { PasswordInput } from "@/components/password-input";
// Deliberately NOT importing GoogleSignInButton here -- see the
// explanation in the same-session chat: a brand-new Google sign-in has
// no way to carry `pending_org_name` the way the password signUp
// action does (it rides in raw_user_meta_data set at supabase.auth.signUp()
// call time, which OAuth's redirect-based flow never goes through), so
// today it would create a bare auth user with no organization and dead-
// end at /app-required. Wiring the button here needs that gap closed
// first (a post-OAuth "create your organization" step), not silently
// shipped broken. The button lives on /login already, for existing
// admins signing back in.

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, { error: null });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Create your fleet account</h1>
          <p className="mt-2 text-sm text-muted">
            Set up your organization and start managing drivers and
            vehicles from this dashboard.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium">
              Company / fleet name
            </label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              required
              autoComplete="organization"
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

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
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
            <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
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
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
