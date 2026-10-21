// Olympus Mont Systems LLC - ControlMiles Web
// src/app/admin/students/[id]/page.tsx
//
// One driving-school student (2026-10-19): details and guardian, hours
// against the requirement (from real trips), classes with miles and route,
// report cards, packages and balance, portal link and certificate. What
// the plan doesn't include isn't shown.

import { PageHeader, PageTabs } from "@/components/page-ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedProfile } from "@/lib/supabase/org-context";
import { getBranchScope } from "@/lib/branch-scope";
import { requireFeature } from "@/lib/fleet-features";
import { driverLabel, fleetDriverIds } from "@/lib/driver-label";
import {
  NO_PROGRAM,
  PROGRAM_COLUMNS,
  STUDENT_COLUMNS,
  SCORE_CLASS,
  SCORE_LABELS,
  formatMinutes,
  money,
  percentOf,
  requirementMet,
  studentName,
  type Program,
  type Student,
  type StudentProgress,
} from "@/lib/driving-school";
import {
  AddStudentPackageForm,
  IssueCertificateButton,
  PortalLinkBox,
  RecordPaymentForm,
  StudentForm,
} from "../student-forms";

type ClassRow = {
  block_id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  status: string;
  instructor_id: string | null;
  vehicle_id: string | null;
  session_id: string | null;
  map_token: string | null;
  minutes: number;
  night_minutes: number;
  miles: number;
  evaluated: boolean;
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Bar({ value, required, label }: { value: number; required: number; label: string }) {
  const pct = percentOf(value, required);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {formatMinutes(value)} / {formatMinutes(required)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-border">
        <div className={`h-full ${pct >= 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const tabParam = (await searchParams).tab;
  const tab = ["overview", "classes", "skills", "billing", "details"].includes(tabParam ?? "") ? tabParam! : "overview";
  const features = await requireFeature("students");
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await getAuthedProfile();
  if (!user) return null;
  const orgId = profile?.default_org_id;
  if (!orgId) return null;

  const { data: student } = await supabase
    .from("ds_students")
    .select(STUDENT_COLUMNS)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!student) notFound();

  const hasEval = features.has("student_evaluations");
  const hasPkg = features.has("student_packages");
  const hasPortal = features.has("student_portal");
  const hasCert = features.has("student_certificates");

  const [
    { data: me },
    { data: priv },
    { data: progRows },
    { data: classRows },
    { data: programRows },
    { data: vehicles },
    fleetIds,
    scope,
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("member_role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("ds_student_private").select("date_of_birth, permit_number").eq("student_id", id).maybeSingle(),
    supabase.rpc("ds_student_progress", { p_org: orgId, p_student: id }),
    supabase.rpc("ds_student_classes", { p_student: id }),
    supabase.from("ds_programs").select(PROGRAM_COLUMNS).eq("organization_id", orgId).order("sort").order("name"),
    supabase.from("vehicles").select("id, nickname, make, model, display_id").eq("organization_id", orgId),
    fleetDriverIds(supabase, orgId),
    getBranchScope(orgId),
  ]);
  const isAdmin = me?.member_role === "owner" || me?.member_role === "admin";
  const programs = (programRows ?? []) as Program[];
  const program = programs.find((p) => p.id === (student as Student).program_id) ?? NO_PROGRAM;
  const hasStateRecords = features.has("state_records");
  const progress = ((progRows ?? []) as StudentProgress[])[0];
  const classes = (classRows ?? []) as ClassRow[];
  const done = classes.filter((c) => c.status === "done");
  const upcoming = classes.filter((c) => c.status === "scheduled").reverse();

  const instructorIds = [...new Set(classes.map((c) => c.instructor_id).filter((x): x is string => !!x))];
  const { data: instructors } = instructorIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", instructorIds)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null }[] };
  const instructorName = new Map(
    (instructors ?? []).map((p) => [p.id, driverLabel(p, fleetIds.get(p.id), "Instructor")]),
  );
  const vehicleName = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      [v.make, v.model].filter(Boolean).join(" ") || v.nickname || v.display_id || "Vehicle",
    ]),
  );

  // Report cards: latest score per skill, and each class's card.
  type Score = { evaluation_id: string; skill_id: string; score: number };
  const [{ data: evals }, { data: skills }] = hasEval
    ? await Promise.all([
        supabase
          .from("ds_evaluations")
          .select("id, shift_block_id, note, created_at, ds_evaluation_scores(evaluation_id, skill_id, score)")
          .eq("student_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("ds_skills").select("id, category, name, sort").eq("organization_id", orgId).order("sort"),
      ])
    : [{ data: [] }, { data: [] }];
  const evalByBlock = new Map(
    (evals ?? []).map((e) => [e.shift_block_id as string, e as { note: string | null; ds_evaluation_scores: Score[] }]),
  );
  const latestBySkill = new Map<string, number>();
  for (const e of evals ?? [])
    for (const s of (e.ds_evaluation_scores ?? []) as Score[]) latestBySkill.set(s.skill_id, s.score);
  const skillName = new Map((skills ?? []).map((k) => [k.id, k.name as string]));
  const categories = [...new Set((skills ?? []).map((k) => k.category as string))];

  const [{ data: packages }, { data: myPackages }] = hasPkg
    ? await Promise.all([
        supabase
          .from("ds_packages")
          .select("id, name, minutes, price_cents")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("ds_student_packages")
          .select("id, name, minutes, price_cents, amount_paid_cents, payment_status, created_at")
          .eq("student_id", id)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }];

  const [{ data: links }, { data: certs }] = await Promise.all([
    hasPortal
      ? supabase.from("ds_portal_links").select("id").eq("student_id", id).is("revoked_at", null)
      : Promise.resolve({ data: [] as { id: string }[] }),
    hasCert
      ? supabase
          .from("ds_certificates")
          .select("id, number, issued_at, sha256")
          .eq("student_id", id)
          .order("issued_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; number: string; issued_at: string; sha256: string }[] }),
  ]);

  const minutes = Number(progress?.minutes ?? 0);
  const night = Number(progress?.night_minutes ?? 0);
  const met = requirementMet({ minutes, night_minutes: night }, program);
  const bought = (myPackages ?? []).reduce((a, p) => a + Number(p.minutes), 0);
  const owed = (myPackages ?? []).reduce((a, p) => a + Number(p.price_cents) - Number(p.amount_paid_cents), 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 lg:py-8">
      <Link href="/admin/students" className="text-sm text-muted hover:text-accent">
        ← Students
      </Link>
      <div className="mt-2">
        <PageHeader
          title={studentName(student as Student)}
          meta={[
            program.name,
            student.guardian_name && `Guardian: ${student.guardian_name}`,
            student.phone,
            student.email,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>
      {/* Redesign (2026-10-20): one student, sections as tabs. */}
      <PageTabs
        base={`/admin/students/${id}`}
        current={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "classes", label: "Classes", count: (classes ?? []).length },
          ...(hasEval && (skills ?? []).length > 0 ? [{ id: "skills", label: "Skills" }] : []),
          ...(hasPkg || hasPortal ? [{ id: "billing", label: hasPkg ? "Packages" : "Portal" }] : []),
          { id: "details", label: "Details" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Hours">
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Program: <span className="font-medium text-foreground">{program.name}</span>
                {program.required_minutes === 0 && " · no required hours"}
              </p>
              {program.required_minutes > 0 && (
                <Bar value={minutes} required={program.required_minutes} label="Behind the wheel" />
              )}
              {program.required_night_minutes > 0 && (
                <Bar value={night} required={program.required_night_minutes} label="At night" />
              )}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Classes</p>
                  <p className="text-lg font-semibold">{progress?.classes_done ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Night</p>
                  <p className="text-lg font-semibold">{formatMinutes(night)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Miles</p>
                  <p className="text-lg font-semibold">{Number(progress?.miles ?? 0).toFixed(1)}</p>
                </div>
              </div>
              <p className="text-xs text-muted">
                From each finished class&apos;s GPS trip; can&apos;t be typed in or edited.
              </p>
              {hasStateRecords && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted">
                    State certificate:{" "}
                    <span className="text-foreground">
                      {student.state_cert_number
                        ? `${student.state_cert_type ?? ""} ${student.state_cert_number}`.trim()
                        : "not recorded"}
                    </span>
                  </span>
                  <a href={`/admin/students/${id}/log`} className="text-accent hover:underline">
                    Print hour log (PDF)
                  </a>
                </div>
              )}
            </div>
          </Section>

          {hasCert && (
            <Section title="Certificate">
              {(certs ?? []).length > 0 && (
                <ul className="mb-4 space-y-2 text-sm">
                  {(certs ?? []).map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{c.number}</span>{" "}
                        <span className="text-muted">
                          · {new Date(c.issued_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        </span>
                      </span>
                      <a href={`/admin/students/${id}/certificate/${c.id}`} className="text-accent hover:underline">
                        Download PDF
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin ? (
                <IssueCertificateButton studentId={id} canIssue={met} />
              ) : (
                <p className="text-sm text-muted">An admin issues the certificate once the hours are met.</p>
              )}
            </Section>
          )}
        </div>
      )}

      {tab === "classes" && (
        <div>
          <Section title="Classes">
            {upcoming.length > 0 && (
              <p className="mb-3 text-sm text-muted">
                Next:{" "}
                {upcoming
                  .slice(0, 3)
                  .map((c) => `${c.block_date} ${time12(c.start_time)}`)
                  .join(" · ")}
                . Schedule more in{" "}
                <Link href="/admin/shifts" className="text-accent hover:underline">
                  Classes
                </Link>
                .
              </p>
            )}
            {done.length === 0 ? (
              <p className="text-sm text-muted">No finished classes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Instructor</th>
                      <th className="py-2 pr-3 font-medium">Car</th>
                      <th className="py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pr-3 font-medium">Night</th>
                      <th className="py-2 pr-3 font-medium">Miles</th>
                      <th className="py-2 pr-3 font-medium">Route</th>
                      {hasEval && <th className="py-2 font-medium">Report card</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((c) => {
                      const ev = evalByBlock.get(c.block_id);
                      return (
                        <tr key={c.block_id} className="border-b border-border align-top last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {c.block_date}
                            <p className="text-xs text-muted">{time12(c.start_time)}</p>
                          </td>
                          <td className="py-2 pr-3">
                            {c.instructor_id ? (instructorName.get(c.instructor_id) ?? "Instructor") : "—"}
                          </td>
                          <td className="py-2 pr-3 text-muted">{c.vehicle_id ? vehicleName.get(c.vehicle_id) : "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{formatMinutes(c.minutes)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatMinutes(c.night_minutes)}</td>
                          <td className="py-2 pr-3">{Number(c.miles).toFixed(1)}</td>
                          <td className="py-2 pr-3">
                            {c.session_id && c.map_token ? (
                              <a
                                href={`/api/trip-map/${c.session_id}/${c.map_token}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent hover:underline"
                              >
                                Map
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          {hasEval && (
                            <td className="py-2">
                              {ev ? (
                                <div className="flex max-w-md flex-wrap gap-1">
                                  {ev.ds_evaluation_scores.map((s) => (
                                    <span
                                      key={s.skill_id}
                                      className={`rounded-full px-2 py-0.5 text-xs ${SCORE_CLASS[s.score]}`}
                                    >
                                      {skillName.get(s.skill_id) ?? "Skill"}: {SCORE_LABELS[s.score]}
                                    </span>
                                  ))}
                                  {ev.note && <p className="w-full text-xs text-muted">“{ev.note}”</p>}
                                </div>
                              ) : (
                                <span className="text-xs text-muted">Not evaluated</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "skills" && hasEval && (skills ?? []).length > 0 && (
        <div>
          <Section title="Skills">
            {latestBySkill.size === 0 ? (
              <p className="text-sm text-muted">
                The instructor rates the skills practiced at the end of each class, in the app.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                  <div key={cat}>
                    <p className="mb-1 text-xs font-semibold text-muted uppercase">{cat}</p>
                    <ul className="space-y-1 text-sm">
                      {(skills ?? [])
                        .filter((k) => k.category === cat)
                        .map((k) => {
                          const sc = latestBySkill.get(k.id);
                          return (
                            <li key={k.id} className="flex items-center justify-between gap-2">
                              <span>{k.name}</span>
                              {sc ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs ${SCORE_CLASS[sc]}`}>
                                  {SCORE_LABELS[sc]}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === "billing" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {hasPkg && (
            <Section title="Packages and balance">
              <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Hours bought</p>
                  <p className="text-lg font-semibold">{formatMinutes(bought)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Hours left</p>
                  <p className="text-lg font-semibold">{formatMinutes(Math.max(0, bought - minutes))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Owed</p>
                  <p className={`text-lg font-semibold ${owed > 0 ? "text-danger" : ""}`}>{money(owed)}</p>
                </div>
              </div>
              {(myPackages ?? []).length > 0 && (
                <ul className="mb-4 space-y-2 text-sm">
                  {(myPackages ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
                    >
                      <span>
                        {p.name} · {formatMinutes(p.minutes)} · {money(p.price_cents)}{" "}
                        <span className="text-muted">
                          ({p.payment_status === "paid" ? "paid" : `${money(p.amount_paid_cents)} paid`})
                        </span>
                      </span>
                      {p.payment_status !== "paid" && <RecordPaymentForm id={p.id} studentId={id} />}
                    </li>
                  ))}
                </ul>
              )}
              <AddStudentPackageForm studentId={id} packages={packages ?? []} />
            </Section>
          )}

          {hasPortal && (
            <Section title="Student and parent link">
              <PortalLinkBox studentId={id} hasLink={(links ?? []).length > 0} />
            </Section>
          )}
        </div>
      )}

      {tab === "details" && (
        <div className="max-w-3xl">
          <Section title="Details">
            <StudentForm
              student={student as Student}
              privateData={priv}
              isAdmin={isAdmin}
              branches={scope.branches.map((b) => ({ id: b.id, name: b.name }))}
              programs={programs.filter((p) => p.is_active || p.id === (student as Student).program_id)}
              stateRecords={hasStateRecords}
              portal={hasPortal}
              sms={features.has("sms_reminders")}
            />
          </Section>
        </div>
      )}
    </main>
  );
}
