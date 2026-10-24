"use client";

// Create / edit forms open from a button as a centered dialog (2026-10-24, the
// owner's change from the right-hand slide-over: its forms were squeezed into
// 440px and rendered badly). Built on the native <dialog> element opened with
// showModal(), which gives what a hand-rolled modal usually misses: focus moves
// inside and stays there, the page behind is inert, Escape closes it, it sits in
// the top layer (no z-index fights) and focus returns to the button on close.
// Also: a visible Close button and a click on the backdrop close it, the page
// behind does not scroll, it never fills the screen (max 85% of the height; the
// form scrolls inside, the title stays), and on a phone it keeps a 16px margin.
// Forms inside can close it with useSheet().close() after saving.

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

const SheetContext = createContext<{ close: () => void; active: boolean } | null>(null);

/** Inside a Sheet: close it (e.g. after a successful save). Outside: no-op. */
export function useSheet() {
  return useContext(SheetContext) ?? { close: () => {}, active: false };
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
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }
  function hide() {
    dialog.current?.close();
  }

  // The page behind must not scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={
          variant === "primary"
            ? "rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            : "rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium transition hover:border-border-strong"
        }
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // A click on the backdrop targets the dialog itself, not its content.
        onClick={(e) => {
          if (e.target === dialog.current) hide();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-border bg-surface p-0 text-left font-normal normal-case text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
      >
        {open && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={hide}
                aria-label="Close"
                className="rounded-md p-1 text-muted transition hover:bg-background hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <SheetContext.Provider value={{ close: hide, active: true }}>{children}</SheetContext.Provider>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
