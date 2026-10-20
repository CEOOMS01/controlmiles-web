// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/students/settings/page.tsx
//
// Driving school settings (2026-10-19): required hours (and night hours),
// reminder window, the skills on the report card and the lesson packages.
// Each part shows only if the plan includes it; admins only.
// Redesign (2026-10-20): one card per section with a section menu, settings
// as rows (name and help on the left, control on the right), programs as a
// summary list that opens to edit.

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { requireFeature } from "@/lib/fleet-features";
import {
  DEFAULT_SETTINGS,
  DS_SETTINGS_COLUMNS,
  PROGRAM_COLUMNS,
  formatMinutes,
  money,
  type DsSettings,
  type Program,
} from "@/lib/driving-school";
import { SettingsSection, SettingsTabs } from "@/components/settings-ui";
import { AddPackageForm, AddProgram, AddSkillForm, DsSettingsForm, ProgramRow, ToggleButton } from "../student-forms";
import { WebsiteForm, type PublicPageSettings } from "../website-forms";


export default async function StudentSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const features = await requireFeature("students");
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;
  const { data: me } = await supabase
    .from("organization_members")
    .select("member_role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (me?.member_role !== "owner" && me?.member_role !== "admin") notFound();

  const hasEval = features.has("student_evaluations");
  const hasPkg = features.has("student_packages");
  if (hasEval) await supabase.rpc("ds_ensure_default_skills", { p_org: orgId });
  await supabase.rpc("ds_ensure_default_programs", { p_org: orgId });

  const [{ data: s }, { data: programs }, { data: skills }, { data: packages }] = await Promise.all([
    supabase.from("ds_settings").select(DS_SETTINGS_COLUMNS).eq("organization_id", orgId).maybeSingle(),
    supabase.from("ds_programs").select(PROGRAM_COLUMNS).eq("organization_id", orgId).order("sort").order("name"),
    hasEval
      ? supabase.from("ds_skills").select("id, category, name, is_active").eq("organization_id", orgId).order("sort")
      : Promise.resolve({ data: [] as { id: string; category: string; name: string; is_active: boolean }[] }),
    hasPkg
      ? supabase.from("ds_packages").select("id, name, minutes, price_cents, is_active").eq("organization_id", orgId).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; minutes: number; price_cents: number; is_active: boolean }[] }),
  ]);
  const settings = (s as DsSettings | null) ?? DEFAULT_SETTINGS;
  const showBooking = features.has("student_booking");
  // Website integration (2026-10-20): the public enrollment page, Enterprise.
  const showWebsite = features.has("student_portal");
  let publicPage: PublicPageSettings | null = null;
  let suggestedSlug = "";
  let siteUrl = "https://controlmiles.com";
  if (showWebsite) {
    const [{ data: pp }, { data: org }, h] = await Promise.all([
      supabase
        .from("ds_public_pages")
        .select("slug, enabled, intro, min_age, terms_url, allowed_origins, custom_domain, domain_token, domain_status, domain_message")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      headers(),
    ]);
    publicPage = (pp as PublicPageSettings | null) ?? null;
    suggestedSlug =
      (org?.name ?? "my-school")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "my-school";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) siteUrl = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  }
  const showReminder = features.has("class_reminders");

  const skillGroups = new Map<string, { id: string; name: string; is_active: boolean }[]>();
  for (const k of skills ?? []) {
    if (!skillGroups.has(k.category)) skillGroups.set(k.category, []);
    skillGroups.get(k.category)!.push(k);
  }
  const tabs = [
    { id: "programs", label: "Programs" },
    ...(showBooking ? [{ id: "booking", label: "Booking" }] : []),
    ...(showReminder && !showBooking ? [{ id: "booking", label: "Reminders" }] : []),
    ...(hasEval ? [{ id: "skills", label: "Report card" }] : []),
    ...(hasPkg ? [{ id: "packages", label: "Packages" }] : []),
    ...(showWebsite ? [{ id: "website", label: "Website" }] : []),
  ];
  const tab = tabs.some((t) => t.id === sp.tab) ? sp.tab! : "programs";

  return (
    <main className="px-6 py-10 sm:px-10">
      <Link href="/admin/students" className="text-sm text-muted hover:text-accent">
        ← Students
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Student settings</h1>
      <p className="mt-1 text-sm text-muted">How your school runs lessons. Changes apply to new bookings and classes.</p>

      <div className="mt-8 flex max-w-5xl flex-col gap-8 lg:flex-row lg:gap-12">
        {tabs.length > 1 && <SettingsTabs base="/admin/students/settings" current={tab} tabs={tabs} />}

        <div className="min-w-0 flex-1 space-y-8">
          {tab === "programs" && (
            <SettingsSection
              title="Programs"
              help="Each group of students and what it needs: required hours, lesson length and whether a parent or guardian is involved."
            >
              <div className="divide-y divide-border border-y border-border">
                {((programs ?? []) as Program[]).map((p) => (
                  <ProgramRow key={p.id} program={p} />
                ))}
                <AddProgram />
              </div>
            </SettingsSection>
          )}

          {tab === "booking" && (
            <SettingsSection
              title={showBooking ? "Booking and reminders" : "Reminders"}
              help={
                showBooking
                  ? "What students can do from their link, your cancellation rules and when reminders go out."
                  : "When the reminder email goes out."
              }
            >
              <DsSettingsForm settings={settings} showBooking={showBooking} showReminder={showReminder} />
            </SettingsSection>
          )}

          {tab === "website" && (
            <SettingsSection
              title="Your website"
              help="Students and parents send an enrollment request from your own site: a link, a button or the form inside your page. Requests wait for you in Students."
            >
              <WebsiteForm page={publicPage} suggestedSlug={suggestedSlug} siteUrl={siteUrl} />
            </SettingsSection>
          )}

          {tab === "skills" && (
            <SettingsSection
              title="Report card"
              help="After each class the instructor rates the skills practiced: needs work, developing, good or mastered."
            >
              <div className="divide-y divide-border border-y border-border">
                {[...skillGroups.entries()].map(([category, list]) => (
                  <div key={category} className="py-4">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{category}</p>
                    <ul className="space-y-1.5 text-sm">
                      {list.map((k) => (
                        <li key={k.id} className="flex items-center justify-between gap-3">
                          <span className={k.is_active ? "" : "text-muted line-through"}>{k.name}</span>
                          <ToggleButton id={k.id} active={k.is_active} kind="skill" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <AddSkillForm />
            </SettingsSection>
          )}

          {tab === "packages" && (
            <SettingsSection title="Packages" help="Lesson packages you sell. Payments are recorded on each student.">
              {(packages ?? []).length === 0 ? (
                <p className="text-sm text-muted">No packages yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Package</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="py-2 pl-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border border-y border-border">
                    {(packages ?? []).map((p) => (
                      <tr key={p.id} className={p.is_active ? "" : "text-muted"}>
                        <td className="py-2.5 pr-3">{p.name}</td>
                        <td className="px-3 py-2.5">{formatMinutes(p.minutes)}</td>
                        <td className="px-3 py-2.5">{money(p.price_cents)}</td>
                        <td className="py-2.5 pl-3 text-right">
                          <ToggleButton id={p.id} active={p.is_active} kind="package" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <AddPackageForm />
            </SettingsSection>
          )}
        </div>
      </div>
    </main>
  );
}
