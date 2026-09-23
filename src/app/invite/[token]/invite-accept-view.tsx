"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  acceptInviteAlreadySignedIn,
  acceptInviteExistingAccount,
  acceptInviteNewAccount,
  type InviteActionState,
} from "./actions";
import { PasswordInput } from "@/components/password-input";

const initialState: InviteActionState = { error: null };

export function InviteAcceptView({
  token,
  valid,
  organizationName,
  inviteEmail,
  accountExists,
  currentUserEmail,
}: {
  token: string;
  valid: boolean;
  organizationName: string | null;
  inviteEmail: string | null;
  accountExists: boolean;
  currentUserEmail: string | null;
}) {
  if (!valid || !inviteEmail) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Invalid or expired invite</h1>
        <p className="mt-2 text-sm text-muted">
          This invite link no longer works — it may have already been used, or your fleet admin
          may need to send a new one.
        </p>
      </div>
    );
  }

  const loggedInAsSameEmail =
    currentUserEmail != null && currentUserEmail.toLowerCase() === inviteEmail.toLowerCase();
  const loggedInAsOtherEmail = currentUserEmail != null && !loggedInAsSameEmail;

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Fleet invite</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Join {organizationName ?? "the fleet"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Invited as <span className="font-medium text-foreground">{inviteEmail}</span>
        </p>
      </div>

      {loggedInAsOtherEmail ? (
        <MismatchNotice inviteEmail={inviteEmail} currentUserEmail={currentUserEmail!} />
      ) : loggedInAsSameEmail ? (
        <AlreadySignedInForm token={token} />
      ) : accountExists ? (
        <ExistingAccountForm token={token} email={inviteEmail} />
      ) : (
        <NewAccountForm token={token} email={inviteEmail} />
      )}
    </div>
  );
}

function MismatchNotice({ inviteEmail, currentUserEmail }: { inviteEmail: string; currentUserEmail: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-center">
      <p className="text-sm">
        You&apos;re signed in as <span className="font-medium">{currentUserEmail}</span>, but this
        invite was sent to <span className="font-medium">{inviteEmail}</span>.
      </p>
      <p className="mt-2 text-xs text-muted">
        Sign out and open this link again to accept with the invited email.
      </p>
    </div>
  );
}

function AlreadySignedInForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInviteAlreadySignedIn(token);
            if (result?.error) setError(result.error);
          })
        }
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invitation"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ExistingAccountForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteExistingAccount, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted">
        You already have a ControlMiles account with this email — sign in to accept.
      </p>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
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
        {pending ? "Joining…" : "Sign in and accept"}
      </button>
      <p className="text-center text-xs text-muted">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="text-accent hover:underline">
          Reset it
        </Link>
        , then open this invite link again.
      </p>
    </form>
  );
}

function NewAccountForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(acceptInviteNewAccount, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted">
        Set a password to create your ControlMiles account and join the fleet.
      </p>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters, with a letter and a number.</p>
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
        {pending ? "Joining…" : "Create account and accept"}
      </button>
    </form>
  );
}
