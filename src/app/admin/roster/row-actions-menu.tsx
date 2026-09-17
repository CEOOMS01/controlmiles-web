"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/roster/row-actions-menu.tsx
//
// Explicit user request, 2026-09-18: the per-row actions (Generate
// report / Make operator / Make admin / Remove, or just Remove for an
// unclaimed slot row) used to all sit inline in the row, always visible
// -- real visual noise once a row could show up to 4 at once. Collapsed
// into one "Actions" button per row. The actions themselves are
// UNCHANGED -- same components, same server actions, same authorization
// -- this is purely a visual container around them.
//
// Rendered through a portal into document.body, positioned from the
// trigger button's own bounding rect, rather than a plain CSS
// `absolute` child -- found live while building this: the roster
// table's wrapper has overflow-x-auto for small-screen horizontal
// scrolling, and per a real CSS rule (an axis left at the `visible`
// default computes to `auto` once the OTHER axis is set to anything
// else), that silently makes overflow-y auto too, clipping a plain
// absolutely-positioned dropdown at the table's own bottom edge. A
// portal escapes that container entirely, so it can't be clipped by it
// no matter how the table itself scrolls.

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export function RowActionsMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ bottom: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Explicit user request: opens UPWARD from the button, not down
      // into the table's own clipped scroll area -- anchored by its
      // BOTTOM edge (viewport height minus the button's top) rather than
      // its top, so the menu grows upward regardless of how tall its
      // content ends up being (no need to know that in advance). Right-
      // aligned to the button -- 256px is this menu's own fixed width
      // (w-64 below).
      // position: fixed coordinates are viewport-relative already -- no
      // scrollX/scrollY offset needed (rect itself is already relative
      // to the viewport, same frame fixed positioning uses).
      setCoords({ bottom: window.innerHeight - rect.top + 4, left: rect.right - 256 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Actions ▾
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ bottom: coords.bottom, left: coords.left }}
            className="fixed z-50 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            <div className="flex flex-col gap-1">{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
