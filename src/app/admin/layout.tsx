import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { CreateOrgForm } from "./create-org-form";
import { SignOutButton } from "./sign-out-button";
import { OrgSwitcher } from "./org-switcher";
import { getOrgFeatures } from "@/lib/fleet-features";
import { getBranchScope } from "@/lib/branch-scope";
import { BranchSelector } from "./branch-controls";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-version";
import { ThemeToggle, type ThemeChoice } from "@/components/theme-toggle";
import { AdminNav, type NavGroup, type NavItem } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();

  // Defense in depth: proxy.ts already gates /admin/* server-side, but a
  // layout that renders org data should never trust that alone.
  if (!user) {
    redirect("/login");
  }

  // 18+ / Terms acceptance must be on record before the dashboard
  // (2026-09-29) -- covers Google sign-ups and pre-existing accounts.
  // Since 2026-10-01 it must be the CURRENT version: a material update
  // (bump LEGAL_TERMS_VERSION) asks admins to accept again, once.
  if (!profile?.legal_accepted_at || profile.legal_terms_version !== LEGAL_TERMS_VERSION) {
    redirect("/onboarding/terms");
  }

  if (!profile?.default_org_id) {
    return <CreateOrgForm />;
  }

  // Real performance bug found live (2026-09-09, user-reported "slow on
  // every click"): these three queries don't depend on each other (only
  // on profile.default_org_id, already known above) but were each
  // awaited one at a time -- since this layout re-runs server-side on
  // EVERY navigation to any /admin/* page (it reads cookies() via
  // Supabase auth, which opts the whole route out of static caching),
  // that meant 3 extra sequential network round-trips to Supabase on
  // every single click through the sidebar, on top of whatever the
  // destination page itself fetches. Parallelized with Promise.all,
  // same pattern admin/page.tsx's own dashboard queries already use.
  const [
    // Having a default_org_id only means "a member of some org" -- a
    // fleet_driver has one too. The admin shell requires actually being
    // that org's owner/admin; checked explicitly rather than inferred
    // from account_type, since RLS is the real authority here and this
    // mirrors it instead of trusting a denormalized field.
    { data: membership },
    { data: org },
    // Real gap closed (explicit user ask, built for testing -- multi-org
    // management is intended to become a paid extra later, see
    // switch_default_organization's own migration comment): every org
    // this account owns/admins, not just the current default_org_id one,
    // so the sidebar can offer a switcher instead of being stuck on
    // whichever org happened to be active last.
    { data: eligibleMemberships },
    // Open fuel alerts, for the badge on "Fuel" (2026-09-30).
    { count: openFuelAlerts },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("member_role")
      .eq("organization_id", profile.default_org_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("id, name, compliance_mode, fleet_type_confirmed_at, use_shift_schedules")
      .eq("id", profile.default_org_id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .eq("user_id", user.id)
      .in("member_role", ["owner", "admin", "operator"])
      .eq("is_active", true),
    supabase
      .from("fuel_anomalies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.default_org_id)
      .eq("status", "open"),
  ]);

  const eligibleOrgs = (eligibleMemberships ?? [])
    .map((m) => {
      const o = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return o ? { id: o.id, name: o.name } : null;
    })
    .filter((o): o is { id: string; name: string } => o !== null);

  if (!org) {
    // default_org_id pointed at something the caller can no longer
    // read (e.g. RLS scope changed, or the row was removed) -- fail
    // safe into onboarding rather than rendering a broken shell.
    return <CreateOrgForm />;
  }

  // Explicit user request, 2026-09-18: an Operator now needs into this
  // shell too -- found live while building the role, this gate had never
  // been touched when Operator was added, so an operator was silently
  // getting turned away at the door with the exact same "not an admin"
  // message a real driver sees, despite the RLS/RPC layer already
  // granting them real power. isOperatorOnly below drives the nav's own
  // scoped-down item list right below.
  const role = membership?.member_role;
  if (role !== "owner" && role !== "admin" && role !== "operator") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div>
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            You&apos;re a member of {org.name}, but not an admin. Use the
            ControlMiles app to track trips — fleet management stays with
            your admin.
          </p>
        </div>
      </main>
    );
  }

  const isOperatorOnly = role === "operator";
  // What this fleet's service and plan include (fn_org_features). Anything
  // else is left out of the menu entirely -- and its page answers 404.
  const features = await getOrgFeatures(org.id);
  const has = features.has;
  // Shifts: recurring schedules once the fleet turns them on, or a driving
  // school's classes.
  const showShifts = (has("shift_schedules") && org.use_shift_schedules) || has("classes");
  const branchScope = await getBranchScope(org.id);

  // Onboarding (2026-09-30): the fleet type is chosen right after sign-up,
  // before the dashboard. Only the owner chooses it (2026-10-03: it's
  // locked afterwards), so only the owner is sent there.
  if (!org.fleet_type_confirmed_at && role === "owner") {
    redirect("/onboarding/fleet-type");
  }

  // Menu (2026-10-20 redesign): grouped by area, icons, current page
  // highlighted; the same gating as before (plan features, operator role).
  const operations: NavItem[] = [
    { href: "/admin/roster", label: "Team", icon: "team" },
    ...(has("school_live") ? [{ href: "/admin/school", label: "School: live", icon: "bus" as const }] : []),
    ...(has("school")
      ? [
          { href: "/admin/school/routes", label: "School routes", icon: "route" as const },
          { href: "/admin/school/students", label: "Schools & students", icon: "students" as const },
          { href: "/admin/school/attendance", label: "Attendance", icon: "attendance" as const },
        ]
      : []),
    ...(has("routes") ? [{ href: "/admin/routes", label: "Routes", icon: "route" as const }] : []),
    ...(showShifts ? [{ href: "/admin/shifts", label: has("classes") ? "Classes" : "Shifts", icon: "calendar" as const }] : []),
    ...(has("students") ? [{ href: "/admin/students", label: "Students", icon: "students" as const }] : []),
    ...(has("geofences") ? [{ href: "/admin/geofences", label: "Geofences", icon: "geofence" as const }] : []),
    ...(!isOperatorOnly && has("trip_approval")
      ? [{ href: "/admin/approvals", label: "Trip approval", icon: "approval" as const }]
      : []),
  ];
  // Everything below stays outside an Operator's RLS/RPC scope: hidden,
  // never shown-but-empty.
  const fleet: NavItem[] = isOperatorOnly
    ? []
    : [
        {
          href: "/admin/fuel",
          label: "Fuel",
          icon: "fuel",
          badge: has("fuel_alerts") ? (openFuelAlerts ?? 0) : 0,
        },
        ...(has("ifta") ? [{ href: "/admin/ifta", label: "IFTA", icon: "ifta" as const }] : []),
        { href: "/admin/maintenance", label: "Maintenance", icon: "maintenance" },
        { href: "/admin/reviews", label: "Reviews", icon: "reviews" },
        ...(has("safety_scores") ? [{ href: "/admin/safety", label: "Safety", icon: "safety" as const }] : []),
      ];
  const admin: NavItem[] = [
    { href: "/admin/import", label: "Import", icon: "import" },
    ...(!isOperatorOnly && has("activity_log") ? [{ href: "/admin/activity", label: "Activity", icon: "activity" as const }] : []),
    ...(!isOperatorOnly && has("fleet_export") ? [{ href: "/admin/export", label: "Export", icon: "export" as const }] : []),
    ...(!isOperatorOnly ? [{ href: "/admin/settings", label: "Settings", icon: "settings" as const }] : []),
  ];
  const groups: NavGroup[] = [
    { items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
    ...(operations.length ? [{ title: "Operations", items: operations }] : []),
    ...(fleet.length ? [{ title: "Fleet", items: fleet }] : []),
    { title: "Admin", items: admin },
  ];
  const themeCookie = (await cookies()).get("cm_theme")?.value;
  const theme: ThemeChoice = themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";

  const header = (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-1.5">
        <Image src="/logo_controlmiles.png" alt="" width={26} height={26} className="rounded-md" />
        <p className="text-sm font-semibold tracking-tight text-sidebar-strong">ControlMiles</p>
      </div>
      <div className="hidden lg:block">
        <OrgSwitcher currentOrgId={org.id} orgs={eligibleOrgs} />
        <BranchSelector
          branches={branchScope.branches.map((b) => ({ id: b.id, name: b.name }))}
          current={branchScope.current?.id ?? null}
        />
      </div>
    </div>
  );
  const footer = (
    <div className="space-y-3 px-1.5">
      <div className="lg:hidden">
        <OrgSwitcher currentOrgId={org.id} orgs={eligibleOrgs} />
        <BranchSelector
          branches={branchScope.branches.map((b) => ({ id: b.id, name: b.name }))}
          current={branchScope.current?.id ?? null}
        />
      </div>
      <ThemeToggle initial={theme} />
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-sidebar-muted">{profile.first_name || user.email}</p>
        <SignOutButton />
      </div>
      <div className="flex gap-3 text-xs text-sidebar-muted">
        <Link href="/privacy" className="hover:text-sidebar-strong">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-sidebar-strong">
          Terms
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <AdminNav groups={groups} header={header} footer={footer} />
      {/* min-w-0: without it a wide table (IFTA, Fuel) stretches the whole
          page sideways instead of scrolling inside its own box. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
