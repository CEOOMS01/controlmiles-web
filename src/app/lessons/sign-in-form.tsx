"use client";

// Driving school client portal sign-in (2026-10-22): an email, then a
// one-time link in the inbox. The answer is the same for any email, so this
// screen never says whether one has a profile.

import { useActionState } from "react";
import { requestLink, type RequestLinkState } from "./actions";

const initial: RequestLinkState = { error: null, sent: false };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(requestLink, initial);

  if (state.sent) {
    return (
      <div className="mt-6 rounded-xl border border-success/40 bg-success/5 p-5 text-sm">
        <h2 className="font-semibold">Check your email</h2>
        <p className="mt-1 text-muted">
          If that email is on file with a driving school, we sent it a sign-in link. It works once and expires in 30
          minutes. Nothing there? Check spam, or ask your school which email they have for you.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          maxLength={120}
          autoComplete="email"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
