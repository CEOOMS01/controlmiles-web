// Olympus Mont Systems LLC - ControlMiles Web
// src/components/settings-ui.tsx
//
// Building blocks shared by the settings pages (2026-10-20): a card per
// section, rows with the setting's name and a one-line explanation on the
// left and its control on the right, switches, two-option toggles and
// number fields with their unit.

import type { ReactNode } from "react";

export const settingsField =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

/**
 * One open section: heading, one-line help, then its rows divided by thin
 * lines. No box around it (redesign 2026-10-20: settings read as a page,
 * not as stacked tables).
 */
export function SettingsSection({
  title,
  help,
  danger,
  children,
}: {
  title: string;
  help?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 className={`text-base font-semibold ${danger ? "text-danger" : ""}`}>{title}</h2>
      {help && <p className="mt-1 max-w-2xl text-sm text-muted">{help}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Vertical tabs on the left (sideways on phones); each tab is its own page
 * (?tab=), so a section never scrolls past the others.
 */
export function SettingsTabs({
  base,
  current,
  tabs,
}: {
  base: string;
  current: string;
  tabs: { id: string; label: string }[];
}) {
  return (
    <nav className="lg:sticky lg:top-6 lg:w-52 lg:shrink-0 lg:self-start" aria-label="Settings">
      <ul className="flex gap-1 overflow-x-auto border-b border-border pb-2 text-sm lg:flex-col lg:border-b-0 lg:pb-0">
        {tabs.map((t) => {
          const active = t.id === current;
          return (
            <li key={t.id}>
              <a
                href={`${base}?tab=${t.id}`}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 whitespace-nowrap transition ${
                  active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingRow({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {help && <p className="mt-0.5 text-xs text-muted">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function GroupTitle({ children }: { children: ReactNode }) {
  return <p className="pt-5 text-xs font-semibold tracking-wide text-muted uppercase first:pt-1">{children}</p>;
}

/** On/off switch that posts like a checkbox ("on" when on). */
export function Switch({
  name,
  defaultChecked,
  label,
  disabled,
  autoSubmit,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  disabled?: boolean;
  /** Save as soon as it's flipped. */
  autoSubmit?: boolean;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-label={label}
        onChange={autoSubmit ? (e) => e.currentTarget.form?.requestSubmit() : undefined}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-border transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-disabled:opacity-60" />
      <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

/** Two or three options side by side, posted as a radio group. */
export function Segmented({
  name,
  value,
  options,
  disabled,
  autoSubmit,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  autoSubmit?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={value === o.value}
            disabled={disabled}
            onChange={autoSubmit ? (e) => e.currentTarget.form?.requestSubmit() : undefined}
            className="peer sr-only"
          />
          <span className="block rounded-md px-3 py-1.5 text-sm text-muted transition peer-checked:bg-accent peer-checked:font-medium peer-checked:text-accent-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Number field with its unit after it ("24 hours"). */
export function UnitInput(props: {
  name: string;
  defaultValue: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        name={props.name}
        type="number"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        defaultValue={props.defaultValue}
        className={`${settingsField} w-24 text-right`}
      />
      <span className="text-sm text-muted">{props.unit}</span>
    </div>
  );
}

/** Saving… / Saved. / error, for forms that save on change. */
export function SaveStatus({ pending, success, error }: { pending: boolean; success: boolean; error: string | null }) {
  if (pending) return <span className="text-xs text-muted">Saving…</span>;
  if (error)
    return (
      <span role="alert" className="text-xs text-danger">
        {error}
      </span>
    );
  if (success) return <span className="text-xs text-success">Saved.</span>;
  return null;
}
