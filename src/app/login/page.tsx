"use client";

import { AuthShell } from "@/components/auth-shell";
import { STAY_SIGNED_IN_COOKIE } from "@/lib/auth/session-persistence";
import { Suspense, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";
import { PasswordInput } from "@/components/password-input";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

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

const REMEMBERED_EMAIL_KEY = "cm_remembered_login_email";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  // "Keep me signed in" -- off by default (shared office computers). The
  // choice is a small non-secret preference cookie the server reads when it
  // sets the auth cookies, for email and Google sign-in alike. See
  // src/lib/auth/session-persistence.ts.
  const [staySignedIn, setStaySignedIn] = useState(false);

  // Per-viewer convenience only, same class of thing as a remembered tab
  // or a collapsed section -- never a credential, just the email string,
  // so read/write is wrapped rather than trusted (a private window or
  // blocked site data throws here, and the form must still work either
  // way).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberEmail(true);
      }
    } catch {
      // Storage unavailable -- form just starts blank, same as before this existed.
    }
    setStaySignedIn(document.cookie.split("; ").includes(`${STAY_SIGNED_IN_COOKIE}=1`));
  }, []);

  function onStaySignedInChange(checked: boolean) {
    setStaySignedIn(checked);
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${STAY_SIGNED_IN_COOKIE}=${checked ? "1" : "0"}; path=/; max-age=31536000; samesite=lax${secure}`;
  }

  function onSubmit() {
    try {
      if (rememberEmail && email) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // Non-fatal -- sign-in itself doesn't depend on this succeeding.
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your fleet dashboard. Drivers sign in from the ControlMiles app."
    >

        <Suspense fallback={null}>
          <PasswordResetNotice />
        </Suspense>

        <GoogleSignInButton />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={formAction} onSubmit={onSubmit} className="space-y-4">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Remember my email
            </label>
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

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={staySignedIn}
              onChange={(e) => onStaySignedInChange(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border"
            />
            <span>
              Keep me signed in
              <span className="block text-xs text-muted">
                Stay signed in for 90 days on this browser. Leave it off on a shared computer.
              </span>
            </span>
          </label>

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
    </AuthShell>
  );
}
