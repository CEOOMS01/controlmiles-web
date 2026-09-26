"use client";

import { useState, useTransition } from "react";
import { resendDriverInvite } from "./actions";

// Row action for a driver who was invited but has not accepted yet (or whose
// link expired). Issues a fresh link for the same driver row and emails it.
export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function handleResend() {
    startTransition(async () => {
      const result = await resendDriverInvite(inviteId);
      setMessage(
        result.error
          ? { text: result.error, ok: false }
          : { text: "Invitation sent again.", ok: true },
      );
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        role="menuitem"
        onClick={handleResend}
        disabled={pending}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-accent transition hover:bg-background disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend invitation"}
      </button>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`px-3 text-xs ${message.ok ? "text-success" : "text-danger"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
