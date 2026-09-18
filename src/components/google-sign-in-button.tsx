"use client";

import { useActionState } from "react";
import { signInWithGoogle, type GoogleOAuthState } from "@/lib/auth/google-oauth";

const initialState: GoogleOAuthState = { error: null };

// Shared by /login and /signup -- see google-oauth.ts for why one
// action covers both. Success never resolves here (the action
// redirects the whole browser to Google, then Google redirects to
// /auth/confirm) -- this component only ever renders the button, or a
// real error if Google itself couldn't be reached (e.g. the provider
// isn't enabled in Supabase yet).
export function GoogleSignInButton() {
  const [state, formAction, pending] = useActionState(signInWithGoogle, initialState);

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-background disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
          </svg>
          {pending ? "Redirecting…" : "Continue with Google"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
