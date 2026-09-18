import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "./organization-form";

// Explicit user requirement (2026-09-18, the second step of "primero se
// loguea y luego crea la organización paso a paso" for Google sign-in):
// a Server Component gate, same shape as /reset-password's own --
// checked before the form ever renders, not just at submit.
//   - No session at all: send to /login (this page only makes sense
//     for someone already authenticated, via Google or otherwise).
//   - Already owns/admins an organization: nothing to onboard, send
//     straight to /admin instead of letting them create a second org
//     from a stale bookmark/back-button visit here.
export default async function CreateOrganizationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: adminMemberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .in("member_role", ["owner", "admin"])
    .eq("is_active", true)
    .limit(1);

  if ((adminMemberships?.length ?? 0) > 0) {
    redirect("/admin");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Set up your fleet</h1>
          <p className="mt-2 text-sm text-muted">
            You&apos;re signed in as {user.email}. One last step: name
            your company or fleet to finish setting up your account.
          </p>
        </div>

        <OrganizationForm />
      </div>
    </main>
  );
}
