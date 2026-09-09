"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onSignOut}
      disabled={pending}
      className="text-xs text-muted transition hover:text-accent disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
