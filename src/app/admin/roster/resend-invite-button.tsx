"use client";

import { useState, useTransition } from "react";
import { resendDriverInvite } from "./actions";
import { showToast } from "./toast-host";

// Row action for a driver who was invited but has not accepted yet (or whose
// link expired). Issues a fresh link for the same driver row and emails it.
//
// The result is shown twice: a short line inside the menu, and a floating
// notice (2026-11-19) that names the address and stays a few seconds, so it is
// still there after the menu closes.
export function ResendInviteButton({ inviteId, email }: { inviteId: string; email?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function handleResend() {
    startTransition(async () => {
      const result = await resendDriverInvite(inviteId);
      if (result.error) {
        setMessage({ text: result.error, ok: false });
        showToast({ text: result.error, ok: false });
      } else {
        setMessage({ text: "Invitation sent again.", ok: true });
        showToast({ text: email ? `Invitation sent again to ${email}.` : "Invitation sent again.", ok: true });
      }
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
