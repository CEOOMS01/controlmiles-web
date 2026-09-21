"use client";

import { Suspense, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";
import { PasswordInput } from "@/components/password-input";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { BackToHome } from "@/components/back-to-home";

// useSearchParams() needs its own Suspense boundary -- split out so it
// wraps only the bit that reads the URL, not the whole page.
function PasswordResetNotice() {
  const params = useSearchParams();
  const reset = params.get("reset") === "1";
  // Set by /auth/confirm when exchangeCodeForSession fails on the
  // Google OAuth callback (expired/cancelled consent, provider not
  // enabled yet in Supabase, etc.) -- a real message instead of
  // silently landing back on Login with no explanation.
  const oauthError = params.get("oauth_error") === "1";
  if (!reset && !oauthError) return null;
  return (
    <p
      role={oauthError ? "alert" : "status"}
      className={`mb-4 rounded-lg border p-3 text-sm ${
        oauthError ? "border-danger text-danger" : "border-border bg-surface"
      }`}
    >
      {oauthError
        ? "Couldn't sign in with Google. Try again, or sign in with email."
        : "Your password was updated. Sign in with your new password."}
    </p>
  );
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <BackToHome />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo_controlmiles.png"
            alt="ControlMiles"
            width={64}
            height={64}
            className="mx-auto rounded-xl"
            priority
          />
          <h1 className="mt-4 text-2xl font-semibold">Fleet Admin</h1>
          <p className="mt-2 text-sm text-muted">
            This dashboard is for fleet administrators.
          </p>
        </div>

        <Suspense fallback={null}>
          <PasswordResetNotice />
        </Suspense>

        <GoogleSignInButton />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

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
