import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateOrgForm } from "./create-org-form";
import { SignOutButton } from "./sign-out-button";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth: proxy.ts already gates /admin/* server-side, but a
  // layout that renders org data should never trust that alone.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_org_id, first_name, account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.default_org_id) {
    return <CreateOrgForm />;
  }

  // Having a default_org_id only means "a member of some org" -- a
  // fleet_driver has one too. The admin shell requires actually being
  // that org's owner/admin; checked explicitly rather than inferred
  // from account_type, since RLS is the real authority here and this
  // mirrors it instead of trusting a denormalized field.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("member_role")
    .eq("organization_id", profile.default_org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, compliance_mode")
    .eq("id", profile.default_org_id)
    .maybeSingle();

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
        <p className="px-2 text-sm font-semibold tracking-wide text-accent uppercase">
          ControlMiles
        </p>
        <p className="mt-1 truncate px-2 text-xs text-muted">{org.name}</p>

        <nav className="mt-6 space-y-1">
          <AdminNavLink href="/admin">Dashboard</AdminNavLink>
          <AdminNavLink href="/admin/roster">Roster</AdminNavLink>
          <AdminNavLink href="/admin/vehicles">Vehicles</AdminNavLink>
          <AdminNavLink href="/admin/ifta">IFTA</AdminNavLink>
          <AdminNavLink href="/admin/reviews">Reviews</AdminNavLink>
          <AdminNavLink href="/admin/maintenance">Maintenance</AdminNavLink>
          <AdminNavLink href="/admin/routes">Routes</AdminNavLink>
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
