"use client";

import { useActionState } from "react";
import { acceptLegalTerms } from "./actions";
import { AgeTermsCheckbox } from "@/components/age-terms-checkbox";

export function TermsForm() {
  const [state, formAction, pending] = useActionState(acceptLegalTerms, { error: null });
  return (
    <form action={formAction} className="space-y-5">
      <AgeTermsCheckbox />
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
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
