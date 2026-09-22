"use client";

// Olympus Mont Systems LLC - ControlMiles
// src/components/time-input.tsx
//
// Real friction fix (explicit user request, 2026-09-22): a native
// <input type="time"> renders whatever picker widget and AM/PM-vs-24h
// format the browser/OS decides, not what the app's own Settings say --
// there's no way to make it honor a user's 12h/24h preference. This is a
// plain text field instead: type digits and it auto-formats itself
// ("0830" -> "08:30" as you type, no separate hour/minute/AM-PM controls
// to tab through), with a clickable AM/PM toggle only when `format` is
// "12h". Always submits the canonical 24-hour "HH:MM" string through a
// hidden input under `name` -- the server action and the `time` column
// it writes to don't need to know or care which format the person typed
// in.

import { useId, useState } from "react";

function parseInitial24h(value: string | undefined): { digits: string; period: "AM" | "PM" } {
  if (!value) return { digits: "", period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h24 = Number(hStr);
  const m = mStr ?? "00";
  if (!Number.isFinite(h24)) return { digits: "", period: "AM" };
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { digits: `${String(h12).padStart(2, "0")}${m}`, period };
}

function formatDisplay(digits: string): string {
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

// Converts the typed digits (in whichever display format) + period into
// the canonical "HH:MM" 24-hour string the database column expects.
function toCanonical24h(digits: string, format: "12h" | "24h", period: "AM" | "PM"): string {
  if (digits.length < 3) return "";
  const hRaw = Number(digits.slice(0, 2));
  const mRaw = Number(digits.slice(2, 4) || "0");
  const minute = Math.min(59, Math.max(0, mRaw));

  if (format === "24h") {
    const hour = Math.min(23, Math.max(0, hRaw));
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const hour12 = Math.min(12, Math.max(1, hRaw));
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimeInput({
  name,
  defaultValue,
  format,
  className,
}: {
  name: string;
  defaultValue?: string;
  format: "12h" | "24h";
  className?: string;
}) {
  const initial = parseInitial24h(defaultValue);
  const [digits, setDigits] = useState(initial.digits);
  const [period, setPeriod] = useState<"AM" | "PM">(initial.period);
  const inputId = useId();

  const maxDigits = 4;
  const canonical = toCanonical24h(digits, format, period);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
    setDigits(raw);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (format !== "12h") return;
    if (e.key.toLowerCase() === "a") setPeriod("AM");
    if (e.key.toLowerCase() === "p") setPeriod("PM");
  }

  return (
    <div className={`flex items-stretch gap-1.5 ${className ?? ""}`}>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={format === "12h" ? "08:30" : "14:30"}
        value={formatDisplay(digits)}
        onChange={onChange}
        onKeyDown={onKeyDown}
        maxLength={5}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {format === "12h" && (
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-2.5 text-xs font-semibold transition ${
                period === p ? "bg-accent text-accent-foreground" : "bg-background text-muted hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name={name} value={canonical} />
    </div>
  );
}
