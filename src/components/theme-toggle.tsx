"use client";

// Day / night / device (2026-10-20). The choice is a cookie (cm_theme) the
// root layout reads to set data-theme on <html>, so the page paints in the
// right colors on the first frame; "device" removes it and follows the OS.

import { useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const OPTIONS: { value: ThemeChoice; label: string; path: string }[] = [
  { value: "light", label: "Day", path: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" },
  { value: "dark", label: "Night", path: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" },
  { value: "system", label: "Device", path: "M3 5h18v11H3zM8 20h8M12 16v4" },
];

// Applied outside the component: it writes to the document and the cookie.
function applyTheme(next: ThemeChoice) {
  const root = document.documentElement;
  if (next === "system") {
    root.removeAttribute("data-theme");
    document.cookie = "cm_theme=; path=/; max-age=0; samesite=lax";
  } else {
    root.setAttribute("data-theme", next);
    document.cookie = `cm_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
}

export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  function pick(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-lg border border-sidebar-border p-0.5">
      {OPTIONS.map((o) => {
        const on = choice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => pick(o.value)}
            className={`flex h-7 w-8 items-center justify-center rounded-md transition ${
              on ? "bg-sidebar-active text-sidebar-strong shadow-sm" : "text-sidebar-muted hover:text-sidebar-strong"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d={o.path} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
