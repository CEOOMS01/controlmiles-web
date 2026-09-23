import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptView } from "./invite-accept-view";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // resolve_driver_invite is anon-callable on purpose (rate-limited by
  // token hash) -- an invite link has to work for someone with no
  // ControlMiles session at all yet. Cast, not a generated Database type
  // -- this RPC's return shape isn't in the project's typegen output.
  const { data: resolved } = (await supabase
    .rpc("resolve_driver_invite", { p_token: token })
    .maybeSingle()) as {
    data: { valid: boolean; organization_name: string | null; email: string | null; account_exists: boolean } | null;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo_controlmiles.png"
            alt="ControlMiles"
            width={64}
            height={64}
            className="mx-auto rounded-xl"
            priority
          />
        </div>

        <InviteAcceptView
          token={token}
          valid={resolved?.valid ?? false}
          organizationName={resolved?.organization_name ?? null}
          inviteEmail={resolved?.email ?? null}
          accountExists={resolved?.account_exists ?? false}
          currentUserEmail={user?.email ?? null}
        />
      </div>
    </main>
  );
}
