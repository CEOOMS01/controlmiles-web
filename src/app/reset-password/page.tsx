import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

// Server Component so the "do you actually have a recovery session"
// check runs before the form ever renders, not just at submit time --
// someone landing here directly (no token_hash exchange via
// /auth/confirm first) gets sent to request a real link instead of a
// form that would just fail on submit.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password?expired=1");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Set a new password</h1>
          <p className="mt-2 text-sm text-muted">
            Choose a new password for your fleet admin account.
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
