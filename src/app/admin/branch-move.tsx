"use client";

// Move an instructor or a student to another branch (2026-10-20, user
// rule): the owner or an admin picks the branch and must write why; every
// move is kept in the branch history (branch_moves, move_to_branch).

import { useRef, useState, useTransition } from "react";
import { moveToBranch } from "./branch-actions";

type Option = { id: string; name: string };

export function BranchMove({
  subjectType,
  subjectId,
  subjectName,
  current,
  branches,
}: {
  subjectType: "member" | "student";
  subjectId: string;
  subjectName: string;
  /** branch id, "any" (instructor works at any branch) or "" (none) */
  current: string;
  branches: Option[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [to, setTo] = useState(current);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label =
    current === "any" ? "Any branch" : (branches.find((b) => b.id === current)?.name ?? "No branch");

  function open() {
    setTo(current);
    setNote("");
    setError(null);
    dialog.current?.showModal();
  }

  function save() {
    if (to === current) return setError("Pick a different branch.");
    if (note.trim().length < 3) return setError("Write why you are making this move.");
    start(async () => {
      const r = await moveToBranch(subjectType, subjectId, to, note.trim());
      if (r.error) return setError(r.error);
      dialog.current?.close();
    });
  }

  return (
    <>
      <span className="inline-flex items-center gap-2">
        <span className="text-sm">{label}</span>
        <button
          type="button"
          onClick={open}
          className="rounded-md border border-border px-2 py-0.5 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
        >
          Move
        </button>
      </span>
      <dialog
        ref={dialog}
        aria-label={`Move ${subjectName}`}
        className="m-auto w-[min(92vw,420px)] rounded-xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/30"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Move {subjectName}</h2>
          <p className="mt-0.5 text-xs text-muted">Now: {label}. The move and its reason are kept in the branch history.</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">To branch</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {subjectType === "member" && <option value="any">Any branch</option>}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Reason</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              required
              placeholder="Covering the new location on weekends"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg px-3.5 py-2 text-sm text-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Moving…" : "Move"}
          </button>
        </div>
      </dialog>
    </>
  );
}
