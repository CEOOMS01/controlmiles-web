// Olympus Mont Systems LLC - ControlMiles Web
// src/components/page-ui.tsx
//
// Page building blocks for the panel (2026-10-20 redesign, user request:
// screens felt spread out with loose functions everywhere). One compact
// header with the page's actions on the right, sections grouped in tabs
// (server links, so each tab is its own URL), and a consistent page frame.

import Link from "next/link";
import type { ReactNode } from "react";

/** The page frame: same padding and max width everywhere. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full px-5 py-7 sm:px-8 lg:py-8 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>;
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A small line under the title (branch, date, counts). */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {meta && <p className="mt-0.5 text-sm text-muted">{meta}</p>}
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section tabs as links (?tab=…), with an optional count per tab. */
export function PageTabs({
  base,
  current,
  tabs,
  keep = {},
}: {
  base: string;
  current: string;
  tabs: { id: string; label: string; count?: number }[];
  /** Other query params to keep on every tab link. */
  keep?: Record<string, string | undefined>;
}) {
  const href = (id: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    q.set("tab", id);
    return `${base}?${q.toString()}`;
  };
  return (
    <div className="mb-5 border-b border-border">
      <nav aria-label="Sections" className="-mb-px flex gap-5 overflow-x-auto">
        {tabs.map((t) => {
          const on = t.id === current;
          return (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={on ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-sm transition ${
                on ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1.5 py-px text-[11px] ${on ? "bg-accent/12 text-accent" : "bg-border/60 text-muted"}`}>
                  {t.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** A bordered card for a table or list. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-x-auto rounded-xl border border-border bg-surface ${className}`}>{children}</div>;
}
