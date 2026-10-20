"use client";

// Website integration (2026-10-20, Enterprise): the school's public
// enrollment page, the sites allowed to embed it, the code to paste, and
// the office's list of requests to approve or decline.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GroupTitle, SettingRow, Switch, UnitInput } from "@/components/settings-ui";
import { approveEnrollment, declineEnrollment, savePublicPage, undoEnrollment, type ActionState } from "./actions";

export type PublicPageSettings = {
  slug: string;
  enabled: boolean;
  intro: string | null;
  min_age: number;
  terms_url: string | null;
  allowed_origins: string[];
};

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
const primaryBtn =
  "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60";
const initial: ActionState = { error: null, success: false };

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  );
}

export function WebsiteForm({
  page,
  suggestedSlug,
  siteUrl,
}: {
  page: PublicPageSettings | null;
  suggestedSlug: string;
  siteUrl: string;
}) {
  const [state, action, pending] = useActionState(savePublicPage, initial);
  const slug = page?.slug ?? suggestedSlug;
  const link = `${siteUrl}/book/${slug}`;
  const button = `<a href="${link}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;font:600 15px system-ui,sans-serif;text-decoration:none">Enroll now</a>`;
  const iframe = `<iframe data-cm-book src="${link}?embed=1" title="Enroll" style="width:100%;max-width:720px;height:1100px;border:0"></iframe>\n<script src="${siteUrl}/cm-book.js" async></script>`;

  return (
    <div>
      <form action={action}>
        <div className="divide-y divide-border border-y border-border">
          <SettingRow title="Online enrollment" help="Students and parents can send an enrollment request from your page.">
            <Switch name="enabled" defaultChecked={page?.enabled ?? false} label="Online enrollment" />
          </SettingRow>
          <SettingRow title="Page address" help={`${siteUrl}/book/…`}>
            <input name="slug" defaultValue={slug} required maxLength={40} className={`${field} w-56`} />
          </SettingRow>
          <SettingRow title="Minimum age" help="Younger students can't send a request online. Use your state's permit age.">
            <UnitInput name="min_age" defaultValue={page?.min_age ?? 15} unit="years" min={13} max={25} />
          </SettingRow>
          <div className="space-y-3 py-4">
            <label className="block">
              <span className="text-sm font-medium">Welcome text</span>
              <span className="mt-0.5 block text-xs text-muted">Shown at the top of the page. Leave empty for the default.</span>
              <textarea name="intro" defaultValue={page?.intro ?? ""} maxLength={600} rows={3} className={`${field} mt-2`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Your terms and privacy page</span>
              <span className="mt-0.5 block text-xs text-muted">Linked next to the agreement checkbox (https://…).</span>
              <input name="terms_url" type="url" defaultValue={page?.terms_url ?? ""} maxLength={300} className={`${field} mt-2`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Websites that can show the form inside their pages</span>
              <span className="mt-0.5 block text-xs text-muted">
                One per line, up to 5, for example https://frontlinedrivingschool.com. Any other site can only link to it.
              </span>
              <textarea
                name="allowed_origins"
                defaultValue={(page?.allowed_origins ?? []).join("\n")}
                rows={3}
                className={`${field} mt-2 font-mono`}
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4">
          {state.error && (
            <span role="alert" className="text-sm text-danger">
              {state.error}
            </span>
          )}
          {state.success && !state.error && <span className="text-sm text-success">Saved.</span>}
          <button type="submit" disabled={pending} className={primaryBtn}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {page && (
        <div className="mt-6">
          <GroupTitle>Add it to your website</GroupTitle>
          {!page.enabled && <p className="mt-2 text-sm text-warning">Turn on online enrollment for the page to open.</p>}
          <div className="divide-y divide-border">
            <CopyBox label="Your page" value={link} />
            <CopyBox label="A button for your site" value={button} />
            <CopyBox label="The form inside your page" value={iframe} />
          </div>
          {page.allowed_origins.length === 0 && (
            <p className="text-xs text-muted">The form shows inside a page only on the websites listed above.</p>
          )}
        </div>
      )}
    </div>
  );
}

export type EnrollmentRequest = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string | null;
  phone: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  program: string | null;
  branch: string | null;
  message: string | null;
  is_minor: boolean;
  consent_by: string;
  consent_name: string;
  sms_opt_in: boolean;
  created_at: string;
  status: "pending" | "approved" | "declined";
  decided_at: string | null;
  student_id: string | null;
};

export function EnrollmentRequests({ requests }: { requests: EnrollmentRequest[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  // Every decision can be undone (user request 2026-10-20).
  const act = (id: string, kind: "approve" | "decline" | "undo") =>
    start(async () => {
      setError(null);
      const r =
        kind === "approve" ? await approveEnrollment(id) : kind === "decline" ? await declineEnrollment(id) : await undoEnrollment(id);
      if (r.error) return setError(r.error);
      router.refresh();
    });

  if (pending.length === 0 && decided.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-accent/40 bg-accent/5 p-5">
      <h2 className="font-semibold">
        Enrollment requests <span className="text-muted">· {pending.length} waiting</span>
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Sent from your website. Approving adds the student as Registered. Any decision can be undone; requests are deleted 90
        days after they arrive.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {pending.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {pending.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
              <RequestDetails r={r} />
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" disabled={busy} onClick={() => act(r.id, "approve")} className={primaryBtn}>
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(r.id, "decline")}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:border-danger"
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Decided ({decided.length})</summary>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-surface">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {r.first_name} {r.last_name}{" "}
                  <span className={r.status === "approved" ? "text-success" : "text-muted"}>
                    · {r.status === "approved" ? "Approved" : "Declined"}
                  </span>
                  {r.decided_at && (
                    <span className="text-muted">
                      {" "}
                      {new Date(r.decided_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {r.status === "approved" && r.student_id && (
                    <a href={`/admin/students/${r.student_id}`} className="text-xs text-accent hover:underline">
                      Open student
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(r.id, "undo")}
                    className="rounded-md border border-border px-2.5 py-1 text-xs hover:border-accent"
                  >
                    {r.status === "approved" ? "Undo approval" : "Restore"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RequestDetails({ r }: { r: EnrollmentRequest }) {
  return (
    <div className="min-w-0">
      <p className="font-medium">
        {r.first_name} {r.last_name}
        <span className="font-normal text-muted">
          {" "}
          · born {new Date(`${r.birth_date}T12:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" })}
          {r.is_minor && " · under 18"}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {[r.program, r.branch, [r.email, r.phone].filter(Boolean).join(" · ")].filter(Boolean).join(" · ")}
      </p>
      {r.guardian_name && (
        <p className="mt-0.5 text-xs text-muted">
          Guardian: {r.guardian_name}
          {[r.guardian_email, r.guardian_phone].filter(Boolean).length > 0 &&
            ` · ${[r.guardian_email, r.guardian_phone].filter(Boolean).join(" · ")}`}
        </p>
      )}
      {r.message && <p className="mt-1 text-xs">“{r.message}”</p>}
      <p className="mt-1 text-xs text-muted">
        Agreed by {r.consent_by === "guardian" ? "parent or guardian" : "student"} ({r.consent_name}) on{" "}
        {new Date(r.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        {r.sms_opt_in && " · texts on"}
      </p>
    </div>
  );
}
