"use client";

import Link from "next/link";
import { useActionState } from "react";
import { openLink, type OpenLinkState } from "../../actions";

const initial: OpenLinkState = { error: null };

export function OpenLinkForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(() => openLink(token), initial);
  return (
    <form action={formAction} className="mt-6 space-y-3">
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Continue"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}{" "}
          <Link href="/lessons" className="font-medium text-accent hover:underline">
            Get a new link
          </Link>
        </p>
      )}
    </form>
  );
}
