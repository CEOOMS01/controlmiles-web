import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          ControlMiles
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-sm text-muted">
          We sent a confirmation link to the email you signed up with.
          Your organization is already set up — confirm your email, then
          sign in to reach your dashboard.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        >
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
