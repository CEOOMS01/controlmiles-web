// The dashboard header every service shares (2026-11-22): the company's name on the left, sitting right on the
// line; on the right the date, then the greeting with the signed-in person's name and their role (owner blue,
// admin green, operator yellow). Edge to edge of the content area, with its line across the whole width.
// It started in the driving school dashboard (2026-11-20) and moved here so the school bus dashboard,
// and any other service, has the same start. Platform code: it knows nothing about any one service.

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  owner: { label: "Owner", cls: "bg-accent/15 text-accent" },
  admin: { label: "Admin", cls: "bg-success/15 text-success" },
  operator: { label: "Operator", cls: "bg-[#fde047] text-[#713f12]" },
};

export function DashboardHeader({
  title,
  suffix,
  date,
  minutes,
  viewerName,
  viewerRole,
}: {
  /** The company's name. */
  title: string;
  /** A smaller part after the name, for example the branch. */
  suffix?: string | null;
  /** The company's own today, YYYY-MM-DD. */
  date: string;
  /** Minutes since midnight on the company's own clock (for the greeting). */
  minutes: number;
  viewerName: string;
  viewerRole: string | null;
}) {
  const longToday = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const greeting = minutes < 12 * 60 ? "Good morning" : minutes < 18 * 60 ? "Good afternoon" : "Good evening";
  const badge = ROLE_BADGE[viewerRole ?? ""] ?? null;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border px-5 pb-3 pt-7 sm:px-8">
      <h1 className="text-2xl font-semibold leading-none tracking-tight">
        {title}
        {suffix && <span className="text-lg font-medium text-muted"> · {suffix}</span>}
      </h1>
      <div className="text-right">
        <p className="text-xs text-muted">{longToday}</p>
        <p className="mt-0.5 text-sm font-medium">
          {greeting}
          {viewerName ? `, ${viewerName}` : ""}
          {badge && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>}
        </p>
      </div>
    </header>
  );
}
