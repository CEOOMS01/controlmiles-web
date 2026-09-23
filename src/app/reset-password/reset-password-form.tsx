"use client";

import { useActionState } from "react";
import { updatePassword, type ResetPasswordState } from "./actions";
import { PasswordInput } from "@/components/password-input";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          New password
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
        <p className="mt-1.5 text-xs text-muted">
          At least 8 characters, with an uppercase letter, a number, and a symbol.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
          Confirm new password
        </label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={8} />
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
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
