"use client";

// Driving school client portal, staff side (2026-10-22): who can sign in to
// /lessons for this student (a parent while the student is a minor, or the
// adult student), and the emancipation record. The rules live in the
// database; this only shows them and sends the requests.

import { useActionState, useState, useTransition } from "react";
import {
  addClientAccess,
  removeClientAccess,
  resendClientAccess,
  setEmancipation,
  type ActionState,
} from "./actions";

export type ClientLink = {
  client_id: string;
  relation: "self" | "guardian";
  is_active: boolean;
  ended_reason: "majority" | "emancipated" | "revoked" | null;
  ended_at: string | null;
  client: { first_name: string; last_name: string; email: string; last_seen_at: string | null } | null;
};

const initial: ActionState = { error: null, success: false };
const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const secondaryBtn =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60";

const ENDED: Record<string, string> = {
  majority: "ended: student reached the age of majority",
  emancipated: "ended: student emancipated",
  revoked: "removed",
};

function Row({ studentId, link }: { studentId: string; link: ClientLink }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const c = link.client;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <span>
        <span className="font-medium">
          {c ? `${c.first_name} ${c.last_name}` : "—"}
        </span>
        <span className="text-muted">
          {" "}
          · {link.relation === "guardian" ? "parent" : "student"} · {c?.email}
          {link.is_active
            ? c?.last_seen_at
              ? ` · last signed in ${new Date(c.last_seen_at).toLocaleDateString("en-US", { dateStyle: "medium" })}`
              : " · hasn't signed in yet"
            : ` · ${ENDED[link.ended_reason ?? "revoked"]}`}
        </span>
      </span>
      {link.is_active && (
        <span className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            className={secondaryBtn}
            onClick={() =>
              start(async () => {
                const r = await resendClientAccess(studentId, link.client_id);
                setMsg(r.error ?? "Sign-in email sent.");
              })
            }
          >
            Send sign-in email
          </button>
          <button
            type="button"
            disabled={pending}
            className="px-2 text-sm text-danger"
            onClick={() =>
              start(async () => {
                const r = await removeClientAccess(studentId, link.client_id);
                setMsg(r.error);
              })
            }
          >
            Remove
          </button>
        </span>
      )}
      {msg && <span className="w-full text-xs text-muted">{msg}</span>}
    </li>
  );
}

export function ClientAccessBox({
  studentId,
  links,
  defaults,
}: {
  studentId: string;
  links: ClientLink[];
  /** Prefill from the student record: the guardian, or the student's own email. */
  defaults: { guardian: { name: string; email: string }; self: { first: string; last: string; email: string } };
}) {
  const [state, formAction, pending] = useActionState(addClientAccess.bind(null, studentId), initial);
  const [relation, setRelation] = useState<"guardian" | "self">("guardian");
  const [gFirst, ...gRest] = defaults.guardian.name.split(" ");
  const pre =
    relation === "guardian"
      ? { first: gFirst ?? "", last: gRest.join(" "), email: defaults.guardian.email }
      : defaults.self;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        People who sign in at <span className="font-mono">/lessons</span> with an email link (no app, no password). A
        parent sees this student only while a minor and not emancipated; at the age of majority their access ends by
        itself and the student can get their own.
      </p>
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <Row key={l.client_id} studentId={studentId} link={l} />
          ))}
        </ul>
      )}
      <form action={formAction} key={relation} className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-medium">Give access to</span>
          <select
            name="relation"
            value={relation}
            onChange={(e) => setRelation(e.target.value as "guardian" | "self")}
            className={field}
          >
            <option value="guardian">The parent or guardian (student under the age of majority)</option>
            <option value="self">The student (adult or emancipated)</option>
          </select>
        </label>
        <input name="first_name" required maxLength={60} placeholder="First name" defaultValue={pre.first} className={field} />
        <input name="last_name" required maxLength={60} placeholder="Last name" defaultValue={pre.last} className={field} />
        <input
          type="email"
          name="email"
          required
          maxLength={120}
          placeholder="Email"
          defaultValue={pre.email}
          className={`${field} sm:col-span-2`}
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={secondaryBtn}>
            {pending ? "Sending…" : "Give access and email the link"}
          </button>
          {state.error && <span className="text-sm text-danger">{state.error}</span>}
          {state.success && <span className="text-sm text-success">Access given; the email is on its way.</span>}
        </div>
      </form>
    </div>
  );
}

export function EmancipationForm({
  studentId,
  emancipatedAt,
  note,
}: {
  studentId: string;
  emancipatedAt: string | null;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState(setEmancipation.bind(null, studentId), initial);
  const [on, setOn] = useState(!!emancipatedAt);
  return (
    <form action={formAction} className="space-y-2 text-sm">
      <p className="text-muted">
        Only after seeing the document (for example, a court order). Recording it ends every parent&apos;s access to
        this student at once; the student can then get their own.
      </p>
      {emancipatedAt && (
        <p>
          Recorded {new Date(emancipatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
          {note ? `: ${note}` : ""}
        </p>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" name="emancipated" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span>This student is legally emancipated</span>
      </label>
      {on && !emancipatedAt && (
        <input
          name="note"
          required
          minLength={3}
          maxLength={300}
          placeholder="What you saw, e.g. court order no. and date"
          className={field}
        />
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || on === !!emancipatedAt} className={secondaryBtn}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && <span className="text-danger">{state.error}</span>}
        {state.success && <span className="text-success">Saved.</span>}
      </div>
    </form>
  );
}
