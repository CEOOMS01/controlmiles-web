import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "../reset-password-form";

// Separate page from the code-entry step on purpose (explicit user
// request, 2026-09-23) -- reachable only with a real recovery session
// already established, either by verifyResetCode (the code-entry page)
// or by clicking the emailed link straight through /auth/confirm's
// token_hash exchange. No session here means neither of those happened;
// sent back to start over rather than showing a password form that
// would just fail on submit.
export default async function ResetNewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/reset-password?expired=1");
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
