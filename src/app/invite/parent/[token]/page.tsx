import type { Metadata } from "next";
import Image from "next/image";

// School bus parent invitation (2026-10-22). Parents use only the
// ControlMiles Fleet app -- this website is for fleet owners, admins and
// operators -- so on a computer this link only says where to open it. The
// app opens https://controlmiles.com/invite/parent/<token> itself (Android
// App Link) and does the sign-up there. Nothing is looked up here: the page
// reads the same for any token, so it reveals nothing about the invitation.

export const metadata: Metadata = {
  title: "Open in ControlMiles Fleet",
  robots: { index: false, follow: false },
};

export default function ParentInvitePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo_controlmiles.png"
          alt="ControlMiles"
          width={64}
          height={64}
          className="mx-auto mb-8 rounded-xl"
          priority
        />
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent access</p>
        <h1 className="mt-1 text-2xl font-semibold">Open this link on your phone</h1>
        <p className="mt-3 text-sm text-muted">
          Parents follow their child&apos;s school bus in the ControlMiles Fleet app. Open the
          email on your phone, with the app installed, and tap the link again. You&apos;ll choose
          your password there and then sign in with the parent ID from the email.
        </p>
      </div>
    </main>
  );
}
