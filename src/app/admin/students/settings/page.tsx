// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/students/settings/page.tsx
//
// Driving school settings (2026-10-19): required hours (and night hours),
// reminder window, the skills on the report card and the lesson packages.
// Each part shows only if the plan includes it; admins only.

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { AddPackageForm, AddSkillForm, DsSettingsForm, ProgramForm, ToggleButton } from "../student-forms";

export default async function StudentSettingsPage() {
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
  const showReminder = features.has("class_reminders");

  return (
    <main className="px-6 py-10 sm:px-10">
      <Link href="/admin/students" className="text-sm text-muted hover:text-accent">
        ← Students
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Student settings</h1>

      <div className="mt-8 max-w-3xl space-y-10">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Programs</h2>
          <p className="mb-3 text-sm text-muted">
            Teens, adults or your own: the hours each one needs (your state&apos;s rule or yours), class length and
            whether the guardian gets the notices. Adults usually need no hours and have no guardian.
          </p>
          <div className="space-y-2">
            {((programs ?? []) as Program[]).map((p) => (
              <ProgramForm key={p.id} program={p} />
            ))}
            <ProgramForm />
          </div>
        </section>

        {(showBooking || showReminder) && (
          <section>
            <h2 className="mb-1 text-lg font-semibold">{showBooking ? "Online booking and reminders" : "Reminders"}</h2>
            <p className="mb-3 text-sm text-muted">
              {showBooking
                ? "Rules for booking from the student link, and when the reminder email goes out."
                : "When the reminder email goes out."}
            </p>
            <DsSettingsForm settings={settings} showBooking={showBooking} showReminder={showReminder} />
          </section>
        )}

        {hasEval && (
          <section>
            <h2 className="mb-1 text-lg font-semibold">Report card skills</h2>
            <p className="mb-3 text-sm text-muted">
              At the end of each class the instructor rates the skills practiced: needs work, developing, good or mastered.
            </p>
            <div className="mb-4 rounded-xl border border-border bg-surface">
              <ul className="divide-y divide-border text-sm">
                {(skills ?? []).map((k) => (
                  <li key={k.id} className="flex items-center justify-between px-4 py-2">
                    <span className={k.is_active ? "" : "text-muted line-through"}>
                      <span className="text-xs text-muted">{k.category} · </span>
                      {k.name}
                    </span>
                    <ToggleButton id={k.id} active={k.is_active} kind="skill" />
                  </li>
                ))}
              </ul>
            </div>
            <AddSkillForm />
          </section>
        )}

        {hasPkg && (
          <section>
            <h2 className="mb-1 text-lg font-semibold">Packages</h2>
            <p className="mb-3 text-sm text-muted">Lesson packages you sell. Payments are recorded by hand on each student.</p>
            {(packages ?? []).length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-surface">
                <ul className="divide-y divide-border text-sm">
                  {(packages ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2">
                      <span className={p.is_active ? "" : "text-muted line-through"}>
                        {p.name} · {formatMinutes(p.minutes)} · {money(p.price_cents)}
                      </span>
                      <ToggleButton id={p.id} active={p.is_active} kind="package" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AddPackageForm />
          </section>
        )}
      </div>
    </main>
  );
}
