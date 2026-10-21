"use client";

import { useTransition } from "react";
import { signOut } from "./actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={pending}
      className="shrink-0 text-xs text-sidebar-muted transition hover:text-sidebar-strong disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
