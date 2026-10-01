import Link from "next/link";

// 18+ and Terms/Privacy (user rule 2026-09-29: the Terms require 18+, so
// every sign-up path shows it -- web and app). Plain required checkbox:
// the browser blocks submit until it's ticked; servers re-check.
export function AgeTermsCheckbox({ name = "accept_legal" }: { name?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} required className="mt-0.5 h-3.5 w-3.5 rounded border-border" />
      <span className="text-muted">
        I confirm I am at least 18 years old and agree to the{" "}
        <Link href="/terms" target="_blank" className="text-accent hover:underline">
          Terms of Service
        </Link>{" "}
        (for organizations, also the{" "}
        <Link href="/terms/fleet" target="_blank" className="text-accent hover:underline">
          Fleet Terms
        </Link>
        ) and{" "}
        <Link href="/privacy" target="_blank" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
