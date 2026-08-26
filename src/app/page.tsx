import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">
          ControlMiles
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Report Portal</h1>
        <p className="mt-3 text-muted">
          A driver generates a one-time access code from the ControlMiles
          app or here; a tax preparer redeems it for a read-only mileage
          summary — no account required on their end.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-xl border border-border bg-surface p-5 text-left transition hover:border-accent"
          >
            <p className="font-semibold">I&apos;m a driver</p>
            <p className="mt-1 text-sm text-muted">
              Sign in to generate a report code.
            </p>
          </Link>
          <Link
            href="/portal/verify"
            className="rounded-xl border border-border bg-surface p-5 text-left transition hover:border-accent"
          >
            <p className="font-semibold">I have an access code</p>
            <p className="mt-1 text-sm text-muted">
              View a driver&apos;s mileage report.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
