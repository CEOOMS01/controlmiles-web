import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { CreateOrgForm } from "./create-org-form";
import { SignOutButton } from "./sign-out-button";
import { OrgSwitcher } from "./org-switcher";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();

  // Defense in depth: proxy.ts already gates /admin/* server-side, but a
  // layout that renders org data should never trust that alone.
  if (!user) {
    redirect("/login");
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
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("member_role")
      .eq("organization_id", profile.default_org_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("id, name, compliance_mode")
      .eq("id", profile.default_org_id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .eq("user_id", user.id)
      .in("member_role", ["owner", "admin"])
      .eq("is_active", true),
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

  if (membership?.member_role !== "owner" && membership?.member_role !== "admin") {
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

  return (
    <div className="flex flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface px-4 py-6 sm:block">
        <div className="flex items-center gap-2 px-2">
          <Image
            src="/logo_controlmiles.png"
            alt="ControlMiles"
            width={28}
            height={28}
            className="rounded"
          />
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">
            ControlMiles
          </p>
        </div>
        <OrgSwitcher currentOrgId={org.id} orgs={eligibleOrgs} />

        <nav className="mt-6 space-y-1">
          <AdminNavLink href="/admin">Dashboard</AdminNavLink>
          <AdminNavLink href="/admin/routes">Routes</AdminNavLink>
          <AdminNavLink href="/admin/vehicles">Vehicles</AdminNavLink>
          <AdminNavLink href="/admin/ifta">IFTA</AdminNavLink>
          <AdminNavLink href="/admin/reviews">Reviews</AdminNavLink>
          <AdminNavLink href="/admin/safety">Safety</AdminNavLink>
          <AdminNavLink href="/admin/maintenance">Maintenance</AdminNavLink>
          <AdminNavLink href="/admin/roster">Roster</AdminNavLink>
          <AdminNavLink href="/admin/export">Export</AdminNavLink>
          <AdminNavLink href="/admin/settings">Settings</AdminNavLink>
        </nav>

        <div className="mt-8 border-t border-border pt-4">
          <p className="px-2 text-xs text-muted">
            Signed in as {profile.first_name || user.email}
          </p>
          <div className="mt-2 px-2">
            <SignOutButton />
          </div>
          <div className="mt-3 flex gap-3 px-2 text-xs text-muted">
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-2 py-1.5 text-sm text-foreground transition hover:bg-background"
    >
      {children}
    </Link>
  );
}
