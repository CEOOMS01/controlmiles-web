"use client";

// Enroll another child from the client portal (2026-10-22). Same questions
// as the school's public page for a minor, without the parent's contact:
// it comes from the signed-in profile. The database checks it all again.

import Link from "next/link";
import { useActionState } from "react";
import { addChild, type AddChildState } from "../actions";

export type ChildFormPage = {
  school: string;
  min_age: number;
  terms_url: string | null;
  programs: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const label = "mb-1 block text-sm font-medium";
const initial: AddChildState = { error: null, done: false };

export function AddChildForm({ page, parentName }: { page: ChildFormPage; parentName: string }) {
  const [state, formAction, pending] = useActionState(addChild, initial);

  if (state.done) {
    return (
      <div className="mt-6 rounded-xl border border-success/40 bg-success/5 p-5 text-sm">
        <h2 className="font-semibold">Request sent</h2>
        <p className="mt-1 text-muted">{page.school} will confirm the enrollment. Your child appears on your portal once it does.</p>
        <Link href="/lessons" className="mt-3 inline-block font-medium text-accent hover:underline">
          Back to your portal
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <fieldset className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Child</legend>
        <label>
          <span className={label}>First name</span>
          <input name="first_name" required maxLength={60} className={input} />
        </label>
        <label>
          <span className={label}>Last name</span>
          <input name="last_name" required maxLength={60} className={input} />
        </label>
        <label>
          <span className={label}>Date of birth</span>
          <input type="date" name="birth_date" required className={input} />
          <span className="mt-1 block text-xs text-muted">Minimum age at this school: {Math.max(page.min_age, 13)}.</span>
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Lessons</legend>
        {page.programs.length > 0 && (
          <label>
            <span className={label}>Program</span>
            <select name="program_id" className={input} defaultValue="">
              <option value="">Not sure yet</option>
              {page.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {page.branches.length > 1 && (
          <label>
            <span className={label}>Location</span>
            <select name="branch_id" className={input} defaultValue="">
              <option value="">Any location</option>
              {page.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={label}>Lesson language</span>
          <select name="preferred_language" className={input} defaultValue="">
            <option value="">No preference</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={label}>Anything the school should know (optional)</span>
          <textarea name="message" maxLength={500} rows={3} className={input} />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm">
        <legend className="px-1 text-sm font-semibold">Agreement</legend>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>
            I am this child&apos;s parent or legal guardian, and I agree to share this information with {page.school} for
            enrollment and lessons.{" "}
            {page.terms_url && (
              <a href={page.terms_url} target="_blank" rel="noopener" className="text-accent hover:underline">
                School terms and privacy
              </a>
            )}
          </span>
        </label>
        <label className="block">
          <span className={label}>Your full name, as your signature</span>
          <input name="consent_name" required minLength={2} maxLength={120} defaultValue={parentName} className={input} />
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
