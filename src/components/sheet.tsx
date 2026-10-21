"use client";

// Slide-over panel (2026-10-20 redesign): create and edit forms open from a
// button in the page header instead of sitting on the page all the time.
// Right side, 420px, scrim, Escape and the close button close it, focus
// moves into it and back to the button. Forms inside can close it with
// useSheet().close() after saving.

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

const SheetContext = createContext<{ close: () => void } | null>(null);

/** Inside a Sheet: close it (e.g. after a successful save). Outside: no-op. */
export function useSheet() {
  return useContext(SheetContext) ?? { close: () => {} };
}

export function Sheet({
  label,
  title,
  description,
  variant = "primary",
  children,
}: {
  label: string;
  title: string;
  description?: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    const btn = trigger.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      btn?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            : "rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-border-strong"
        }
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex h-full w-full max-w-[440px] flex-col border-l border-border bg-surface shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted transition hover:bg-background hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <SheetContext.Provider value={{ close: () => setOpen(false) }}>{children}</SheetContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
