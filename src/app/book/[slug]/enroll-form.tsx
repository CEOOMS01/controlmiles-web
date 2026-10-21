"use client";

// Enrollment request form (2026-10-20). Asks only what the school needs to
// call back: no permit number, address or ID (the office takes those at
// intake). Under 18, a parent or guardian fills in their contact and gives
// the consent. Inside an iframe it tells the host page its height
// (public/cm-book.js resizes the frame).

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { sendEnrollment, type EnrollState } from "./actions";

type Page = {
  school: string;
  min_age: number;
  terms_url: string | null;
  programs: { id: string; name: string }[];
  branches: { id: string; name: string }[];
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const label = "mb-1 block text-sm font-medium";

function ageOn(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const b = new Date(`${birth}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

const initial: EnrollState = { error: null, done: false };

export function EnrollForm({ slug, page, embed }: { slug: string; page: Page; embed: boolean }) {
  const [state, formAction, pending] = useActionState(sendEnrollment.bind(null, slug), initial);
  const [birth, setBirth] = useState("");
  const [sms, setSms] = useState(false);
  const age = useMemo(() => ageOn(birth), [birth]);
  const minor = age != null && age < 18;
  const tooYoung = age != null && age < Math.max(page.min_age, 13);
  const root = useRef<HTMLDivElement>(null);

  // Embedded: report the height so the school's page can size the frame.
  useEffect(() => {
    if (!embed || window.parent === window || !root.current) return;
    const send = () =>
      window.parent.postMessage({ type: "cm-book-height", height: document.documentElement.scrollHeight }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(root.current);
    send();
    return () => ro.disconnect();
  }, [embed]);

  if (state.done) {
    return (
      <div ref={root} className="mt-6 rounded-xl border border-success/40 bg-success/5 p-5">
        <h2 className="font-semibold">Request sent</h2>
        <p className="mt-1 text-sm text-muted">
          {page.school} will contact you to confirm enrollment and schedule the first lesson.
        </p>
      </div>
    );
  }

  return (
    <div ref={root}>
      <form action={formAction} className="mt-6 space-y-6">
        {/* Honeypot (hidden from people and screen readers). */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
        >
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <legend className="px-1 text-sm font-semibold">Student</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>First name</span>
              <input name="first_name" required maxLength={60} autoComplete="given-name" className={input} />
            </label>
            <label>
              <span className={label}>Last name</span>
              <input name="last_name" required maxLength={60} autoComplete="family-name" className={input} />
            </label>
            <label>
              <span className={label}>Date of birth</span>
              <input
                type="date"
                name="birth_date"
                required
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className={input}
              />
            </label>
            <label>
              <span className={label}>Phone {minor ? "(optional)" : ""}</span>
              <input type="tel" name="phone" maxLength={30} autoComplete="tel" className={input} />
            </label>
            <label className="sm:col-span-2">
              <span className={label}>Email {minor ? "(optional)" : ""}</span>
              <input type="email" name="email" maxLength={120} autoComplete="email" className={input} />
            </label>
          </div>
          {tooYoung && (
            <p role="alert" className="text-sm text-danger">
              Students must be at least {Math.max(page.min_age, 13)} to enroll online with {page.school}.
            </p>
          )}
          {!minor && age != null && !tooYoung && (
            <p className="text-xs text-muted">Enter an email or a phone number so the school can reach you.</p>
          )}
        </fieldset>

        {minor && !tooYoung && (
          <fieldset className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <legend className="px-1 text-sm font-semibold">Parent or guardian</legend>
            <p className="text-xs text-muted">
              Required for students under 18. The parent or guardian sends this request.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={label}>Full name</span>
                <input name="guardian_name" required maxLength={120} autoComplete="name" className={input} />
              </label>
              <label>
                <span className={label}>Phone</span>
                <input type="tel" name="guardian_phone" maxLength={30} autoComplete="tel" className={input} />
              </label>
              <label>
                <span className={label}>Email</span>
                <input type="email" name="guardian_email" maxLength={120} autoComplete="email" className={input} />
              </label>
            </div>
            <p className="text-xs text-muted">Enter at least an email or a phone number.</p>
          </fieldset>
        )}

        {
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
        }

        <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm">
          <legend className="px-1 text-sm font-semibold">Agreement</legend>
          <input type="hidden" name="consent_by" value={minor ? "guardian" : "student"} />
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="sms_opt_in"
              checked={sms}
              onChange={(e) => setSms(e.target.checked)}
              className="mt-1"
            />
            <span>Text me lesson reminders (optional). Message and data rates may apply; reply STOP to opt out.</span>
          </label>
          {sms && (
            <label className="block pl-6">
              <span className={label}>Mobile number for texts</span>
              <input type="tel" name="sms_phone" maxLength={30} autoComplete="tel" className={input} />
            </label>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>
              {minor
                ? `I am this student's parent or legal guardian, and I agree to share this information with ${page.school} so it can contact us about enrollment.`
                : `I agree to share this information with ${page.school} so it can contact me about enrollment.`}{" "}
              {page.terms_url && (
                <a href={page.terms_url} target="_blank" rel="noopener" className="text-accent hover:underline">
                  School terms and privacy
                </a>
              )}
            </span>
          </label>
          <label className="block">
            <span className={label}>
              {minor ? "Parent or guardian's full name" : "Your full name"}, as your signature
            </span>
            <input name="consent_name" required minLength={2} maxLength={120} className={input} />
          </label>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || tooYoung}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
