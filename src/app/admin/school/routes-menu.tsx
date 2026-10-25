// Olympus Mont Systems LLC - ControlMiles
// src/app/admin/school/routes-menu.tsx
//
// The Routes area's top menu (2026-10-24, user request): every button of the
// routes pages in one bar instead of cards -- Routes, Schools, Attendance and
// the New route button. Server links, so each is its own URL.

import Link from "next/link";

type Active = "routes" | "schools" | "attendance" | "new";

const ITEMS: { id: Exclude<Active, "new">; label: string; href: string }[] = [
  { id: "routes", label: "Routes", href: "/admin/school/routes" },
  { id: "schools", label: "Schools", href: "/admin/school/routes?tab=schools" },
  { id: "attendance", label: "Attendance", href: "/admin/school/attendance" },
];

export function RoutesMenu({ active, count }: { active: Active; count?: { routes?: number; schools?: number } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border print:hidden">
      <nav aria-label="Routes" className="-mb-px flex gap-5 overflow-x-auto">
        {ITEMS.map((i) => {
          const on = i.id === active;
          const n = count?.[i.id as "routes" | "schools"];
          return (
            <Link
              key={i.id}
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-sm transition ${
                on ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {i.label}
              {n != null && (
                <span className={`rounded-full px-1.5 py-px text-[11px] ${on ? "bg-accent/12 text-accent" : "bg-border/60 text-muted"}`}>{n}</span>
              )}
            </Link>
          );
        })}
      </nav>
      {/* Only where routes are made: not on Schools or Attendance. */}
      {(active === "routes" || active === "new") && (
        <Link
          href="/admin/school/routes/new"
          className={`mb-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
            active === "new" ? "bg-border/60 text-muted" : "bg-accent text-accent-foreground hover:opacity-90"
          }`}
        >
          + New route
        </Link>
      )}
    </div>
  );
}
