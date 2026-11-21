"use client";

import { useActionState, useState } from "react";
import { SaveStatus, settingsField } from "@/components/settings-ui";
import {
  addInstructorNotice,
  deleteInstructorNotice,
  setInstructorNoticeActive,
  updateInstructorNotice,
  type NoticeState,
} from "./notice-actions";

export type InstructorNotice = { id: string; body: string; is_active: boolean; ends_on: string | null };

const initialState: NoticeState = { error: null, success: false };

function endLabel(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoticeRow({ n }: { n: InstructorNotice }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: NoticeState, fd: FormData) => {
    const r = await updateInstructorNotice(prev, fd);
    if (r.success) setEditing(false);
    return r;
  }, initialState);

  if (editing) {
    return (
      <li className="px-3 py-3 text-sm">
        <form action={formAction}>
          <input type="hidden" name="id" value={n.id} />
          <textarea
            name="body"
            defaultValue={n.body}
            maxLength={300}
            rows={2}
            autoFocus
            aria-label="Edit reminder"
            className={settingsField}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">
              Ends on
              <input
                type="date"
                name="ends_on"
                defaultValue={n.ends_on ?? ""}
                aria-label="End date (optional)"
                className={`${settingsField} w-auto`}
              />
            </label>
            <div className="flex items-center gap-3">
              {state.error && <span className="text-xs text-danger">{state.error}</span>}
              <button type="button" onClick={() => setEditing(false)} className="text-xs font-medium text-muted hover:underline">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-sm">
      <span className={`min-w-0 flex-1 ${n.is_active ? "" : "text-muted line-through"}`}>
        {n.body}
        {n.ends_on && <span className="ml-2 text-xs text-muted">until {endLabel(n.ends_on)}</span>}
      </span>
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-accent hover:underline">
        Edit
      </button>
      <form action={setInstructorNoticeActive}>
        <input type="hidden" name="id" value={n.id} />
        <input type="hidden" name="active" value={n.is_active ? "false" : "true"} />
        <button type="submit" className="text-xs font-medium text-accent hover:underline">
          {n.is_active ? "Switch off" : "Switch on"}
        </button>
      </form>
      <form action={deleteInstructorNotice}>
        <input type="hidden" name="id" value={n.id} />
        <button type="submit" className="text-xs font-medium text-danger hover:underline">
          Delete
        </button>
      </form>
    </li>
  );
}

// Reminders every instructor sees on the home of the Fleet app, one after another (2026-11-19). The app shows
// the active ones that have not ended; with none, it shows no box.
export function InstructorNoticeCard({ orgId, notices }: { orgId: string; notices: InstructorNotice[] }) {
  const [state, formAction, pending] = useActionState(addInstructorNotice, initialState);
  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5">
      <p className="font-semibold">Reminders for instructors</p>
      <p className="mt-1 text-sm text-muted">
        Shown to every instructor on the app&apos;s home screen, one after another: a rule, a closure, a reminder.
        Switch one off to hide it, or give it an end date.
      </p>

      {notices.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {notices.map((n) => (
            <NoticeRow key={n.id} n={n} />
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="org_id" value={orgId} />
        <textarea
          name="body"
          maxLength={300}
          rows={2}
          aria-label="New reminder"
          placeholder="Park in the back lot. Fill the tank when it is under a quarter."
          className={settingsField}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            Ends on
            <input type="date" name="ends_on" aria-label="End date (optional)" className={`${settingsField} w-auto`} />
          </label>
          <div className="flex items-center gap-3">
            <SaveStatus pending={false} success={!pending && state.success} error={state.error} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add reminder"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
