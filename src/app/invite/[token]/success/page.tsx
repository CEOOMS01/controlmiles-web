import Image from "next/image";

// Deliberately generic ("open the app and sign in") rather than naming a
// specific login method -- accept_driver_invite gives this person BOTH a
// real email/password account AND (when the invite came with a claimed
// slot) a CM-D#### driver ID, and this page can't tell which one they'll
// reach for on the mobile app without duplicating that logic here.
export default function InviteSuccessPage() {
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
      </div>
    </main>
  );
}
