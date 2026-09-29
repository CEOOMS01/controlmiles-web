"use client";

import { useActionState } from "react";
import { setIndustryTemplate, type IndustryTemplateState } from "./actions";

const initialState: IndustryTemplateState = { error: null, success: false };

// Industry templates (2026-09-29): the fleet says what kind of business it
// is and ControlMiles switches on only what fits (researched: HubSpot /
// Connecteam / Jobber ask the industry and tailor features + vocabulary).
// Available on every fleet plan for now.
const TEMPLATES = [
  {
    value: "general",
    title: "General fleet",
    body: "Delivery, service, sales or any mixed fleet. Weekly shifts, routes, live map and mileage.",
  },
  {
    value: "driving_school",
    title: "Driving school",
    body: "Everything in General, plus hourly Classes: schedule lessons per instructor and vehicle, with a start window and a day that stays open between classes.",
  },
] as const;

export function IndustryTemplateForm({
  orgId,
  current,
}: {
  orgId: string;
  current: "general" | "driving_school";
}) {
  const [state, formAction, pending] = useActionState(setIndustryTemplate, initialState);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="org_id" value={orgId} />
      <p className="text-sm font-medium">Industry template</p>
      <p className="mt-1 text-sm text-muted">
        Tailors ControlMiles to your kind of fleet. You can change it anytime; nothing you&apos;ve
        recorded is lost.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <label
            key={t.value}
            className={`cursor-pointer rounded-lg border p-4 text-sm transition ${
              current === t.value ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name="industry_template"
                value={t.value}
                defaultChecked={current === t.value}
                disabled={pending}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              />
              {t.title}
            </span>
            <span className="mt-1 block text-muted">{t.body}</span>
          </label>
        ))}
      </div>

      {pending && <p className="mt-2 text-sm text-muted">Saving…</p>}
      {!pending && state.success && <p className="mt-2 text-sm text-success">Saved.</p>}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
