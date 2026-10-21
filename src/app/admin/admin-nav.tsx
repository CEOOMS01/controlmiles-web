"use client";

// Panel navigation (2026-10-20 redesign): icon + label, grouped by area,
// the current page highlighted. On phones the same menu opens from a top
// bar (before, phones had no menu at all).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavIcon =
  | "dashboard"
  | "team"
  | "bus"
  | "route"
  | "attendance"
  | "calendar"
  | "students"
  | "geofence"
  | "import"
  | "fuel"
  | "ifta"
  | "reviews"
  | "approval"
  | "safety"
  | "activity"
  | "maintenance"
  | "export"
  | "settings";

const ICONS: Record<NavIcon, string> = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 6",
  bus: "M5 4h14v12H5zM5 10h14M8 19v-3M16 19v-3M8 13h.01M16 13h.01",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8",
  attendance: "M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 14l2 2 4-4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3",
  students: "M12 5 2 10l10 5 10-5-10-5ZM6 12v5c3 2 9 2 12 0v-5",
  geofence: "M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12ZM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  import: "M12 3v12M7 10l5 5 5-5M4 19h16",
  fuel: "M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M3 20h12M6 8h6M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3",
  ifta: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  reviews: "M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8Z",
  approval: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12l3 3 5-6",
  safety: "M12 3 4 6v6c0 4.4 3.4 8 8 9 4.6-1 8-4.6 8-9V6l-8-3ZM9 12l2 2 4-4",
  activity: "M3 12h4l3 7 4-14 3 7h4",
  maintenance: "M14.7 6.3a4 4 0 0 0-5.3 5.3L4 17l3 3 5.4-5.4a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.6-.6-2.5 2.6-2.4Z",
  export: "M12 15V3M7 8l5-5 5 5M4 19h16",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
};

export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // The most specific match wins (/admin/school/routes over /admin/school).
  const all = groups.flatMap((g) => g.items);
  const current = all
    .filter((i) => isActive(pathname, i.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Panel" className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.title ?? gi}>
          {g.title && (
            <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wider text-sidebar-muted uppercase">{g.title}</p>
          )}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const on = i.href === current;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                      on
                        ? "bg-sidebar-active font-medium text-sidebar-strong shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                        : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-strong"
                    }`}
                  >
                    <Icon name={i.icon} />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.badge ? (
                      <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] leading-none font-semibold text-danger-foreground">
                        {i.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav({ groups, header, footer }: { groups: NavGroup[]; header: ReactNode; footer: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Phones and tablets: a top bar with the menu behind a button. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
        <div className="min-w-0">{header}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="rounded-lg border border-sidebar-border px-3 py-1.5 text-sm text-sidebar-strong"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="admin-mobile-nav" className="border-b border-sidebar-border bg-sidebar px-3 pt-3 pb-4 lg:hidden">
          <NavList groups={groups} onNavigate={() => setOpen(false)} />
          <div className="mt-5 border-t border-sidebar-border pt-4">{footer}</div>
        </div>
      )}

      {/* Laptops and wider: a fixed sidebar. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <div className="px-1">{header}</div>
        <div className="mt-6 flex-1">
          <NavList groups={groups} />
        </div>
        <div className="mt-6 border-t border-sidebar-border pt-4">{footer}</div>
      </aside>
    </>
  );
}
