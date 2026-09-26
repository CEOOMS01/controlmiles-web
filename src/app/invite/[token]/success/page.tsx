import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

// A fleet driver signs in on the ControlMiles app with their CM-D#### driver
// ID and the password they just chose -- not with their email (see the
// Driver ID mode of the app's login screen and resolve-driver-login). Their
// admin sees that ID on the roster, but neither the invitation email nor this
// page ever told the driver, so a newly joined driver could not sign in
// without asking for it. It is shown here when it can be read (the slot this
// account just claimed). When it cannot -- the read is refused, or the invite
// came without a slot -- the page falls back to generic text: never an error
// on the one screen that says "you're in".
export default async function InviteSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayId: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("fleet_driver_slots")
      .select("display_id")
      .eq("claimed_by", user.id)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    displayId = data?.display_id ?? null;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo_controlmiles.png"
          alt="ControlMiles"
          width={64}
          height={64}
          className="mx-auto rounded-xl"
          priority
        />
        <h1 className="mt-4 text-2xl font-semibold">You&apos;re in</h1>
        <p className="mt-2 text-sm text-muted">
          Open the ControlMiles app on your phone and sign in to start tracking trips.
        </p>
        {displayId && (
          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">Your driver ID</p>
            <p className="mt-1 font-mono text-xl tracking-wider">{displayId}</p>
            <p className="mt-2 text-xs text-muted">
              In the app, choose Driver ID and sign in with this ID and the
              password you just chose. Write it down or take a screenshot.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
