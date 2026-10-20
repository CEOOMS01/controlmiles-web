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
import { AddPackageForm, AddProgram, AddSkillForm, DsSettingsForm, ProgramRow, ToggleButton } from "../student-forms";

function Card({ id, title, help, children }: { id: string; title: string; help: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{help}</p>
      </header>
      {children}
    </section>
  );
}

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

  const skillGroups = new Map<string, { id: string; name: string; is_active: boolean }[]>();
  for (const k of skills ?? []) {
    if (!skillGroups.has(k.category)) skillGroups.set(k.category, []);
    skillGroups.get(k.category)!.push(k);
  }
  const sections = [
    { id: "programs", label: "Programs" },
    ...(showBooking || showReminder
      ? [{ id: "booking", label: showBooking ? "Booking and reminders" : "Reminders" }]
      : []),
    ...(hasEval ? [{ id: "skills", label: "Report card" }] : []),
    ...(hasPkg ? [{ id: "packages", label: "Packages" }] : []),
  ];

  return (
    <main className="px-6 py-10 sm:px-10">
      <Link href="/admin/students" className="text-sm text-muted hover:text-accent">
        ← Students
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Student settings</h1>
      <p className="mt-1 text-sm text-muted">How your school runs lessons. Changes apply to new bookings and classes.</p>

      <div className="mt-8 flex max-w-5xl flex-col gap-8 lg:flex-row">
        {sections.length > 1 && (
          <nav className="lg:sticky lg:top-6 lg:w-52 lg:shrink-0 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto text-sm lg:flex-col">
              {sections.map((x) => (
                <li key={x.id}>
                  <a
                    href={`#${x.id}`}
                    className="block rounded-lg px-3 py-2 whitespace-nowrap text-muted hover:bg-surface hover:text-foreground"
                  >
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="min-w-0 flex-1 space-y-6">
          <Card
            id="programs"
            title="Programs"
            help="Each group of students and what it needs: required hours, lesson length and whether a parent or guardian is involved."
          >
            <div className="divide-y divide-border">
              {((programs ?? []) as Program[]).map((p) => (
                <ProgramRow key={p.id} program={p} />
              ))}
              <AddProgram />
            </div>
          </Card>

          {(showBooking || showReminder) && (
            <Card
              id="booking"
              title={showBooking ? "Booking and reminders" : "Reminders"}
              help={
                showBooking
                  ? "What students can do from their link, your cancellation rules and when reminders go out."
                  : "When the reminder email goes out."
              }
            >
              <DsSettingsForm settings={settings} showBooking={showBooking} showReminder={showReminder} />
            </Card>
          )}

          {hasEval && (
            <Card
              id="skills"
              title="Report card"
              help="After each class the instructor rates the skills practiced: needs work, developing, good or mastered."
            >
              <div className="divide-y divide-border">
                {[...skillGroups.entries()].map(([category, list]) => (
                  <div key={category} className="px-5 py-4">
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
            </Card>
          )}

          {hasPkg && (
            <Card id="packages" title="Packages" help="Lesson packages you sell. Payments are recorded on each student.">
              {(packages ?? []).length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No packages yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2 font-medium">Package</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border border-t border-border">
                    {(packages ?? []).map((p) => (
                      <tr key={p.id} className={p.is_active ? "" : "text-muted"}>
                        <td className="px-5 py-2.5">{p.name}</td>
                        <td className="px-3 py-2.5">{formatMinutes(p.minutes)}</td>
                        <td className="px-3 py-2.5">{money(p.price_cents)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <ToggleButton id={p.id} active={p.is_active} kind="package" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <AddPackageForm />
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
