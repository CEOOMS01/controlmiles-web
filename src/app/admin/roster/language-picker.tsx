"use client";

// Driving schools (2026-10-20): the languages an instructor teaches in.
// Online booking uses it only to match a student's preference; the
// instructor is then picked at random among those who match.

import { useState, useTransition } from "react";
import { setMemberLanguages } from "./actions";

const LANGS: { code: "en" | "es"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
];

export function LanguagePicker({ userId, current }: { userId: string; current: string[] }) {
  const [value, setValue] = useState<string[]>(current.length ? current : ["en"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(code: string) {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    if (next.length === 0) return; // at least one
    const prev = value;
    setValue(next);
    setError(null);
    start(async () => {
      const r = await setMemberLanguages(userId, next);
      if (r.error) {
        setValue(prev);
        setError(r.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span role="group" aria-label="Teaches in" className="inline-flex gap-1">
        {LANGS.map((l) => {
          const on = value.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => toggle(l.code)}
              className={`rounded-full border px-2 py-0.5 text-xs transition ${
                on ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:border-border-strong"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
