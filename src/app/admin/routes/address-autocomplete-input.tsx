"use client";

// Address field with a SEARCH button (2026-10-24). It replaces the old
// type-ahead that sent every keystroke to the public Photon service: the
// public geocoders we may use for free either forbid search-as-you-type
// (OpenStreetMap Nominatim) or have no published terms, and a student's home
// address is personal data of a minor that must not be streamed to a third
// party while someone types. Now the address is sent once, when the person
// presses Search or Enter, to OUR server (src/lib/geocode.ts), which decides
// which service may receive it:
//
//   kind="personal"  student home address -> U.S. Census Geocoder only
//   kind="place"     school / depot / stop -> cache, Census, then Nominatim
//
// Still a plain text <input name=...> plus optional hidden latitude/longitude
// inputs, so the existing server actions need no changes. The component keeps
// its old name because five screens already import it.

import { useEffect, useId, useRef, useState } from "react";
import { searchAddress } from "../geocode-actions";

type Match = { address: string; lat: number; lon: number };

export function AddressAutocompleteInput({
  name,
  label,
  placeholder,
  required,
  latName,
  lonName,
  onPick,
  resetOnPick,
  defaultValue,
  defaultCoords,
  kind = "place",
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** When set, the picked match's coordinates are submitted too (hidden
   *  inputs); cleared when the text is edited by hand. */
  latName?: string;
  lonName?: string;
  /** Called with the chosen match (route builder: add it as a stop). */
  onPick?: (p: { address: string; lat: number; lon: number }) => void;
  /** Clear the field after a pick, ready for the next address. */
  resetOnPick?: boolean;
  /** Editing: the saved address and its coordinates. */
  defaultValue?: string | null;
  defaultCoords?: { lat: number; lon: number } | null;
  /** "personal": a person's home address (never leaves for Nominatim). */
  kind?: "personal" | "place";
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(defaultCoords ?? null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMatches([]);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function search() {
    if (loading) return;
    setMessage(null);
    setMatches([]);
    if (value.trim().length < 5) return setMessage("Type the street number, street and city, then search.");
    setLoading(true);
    try {
      const r = await searchAddress(value, kind);
      if (r.error) setMessage(r.error);
      else if (r.results.length === 0) {
        setMessage(
          kind === "personal"
            ? "No match. Check the street number and city, or leave out the apartment. You can still save it and fix it later."
            : "No match. Check the spelling, or add the city and state.",
        );
      } else if (r.results.length === 1 && !r.note) pick(r.results[0]);
      else {
        setMatches(r.results);
        if (r.note) setMessage(r.note);
      }
    } catch {
      setMessage("The address search is not available right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function pick(m: Match) {
    onPick?.({ address: m.address, lat: m.lat, lon: m.lon });
    setValue(resetOnPick ? "" : m.address);
    setCoords(resetOnPick ? null : { lat: m.lat, lon: m.lon });
    setMatches([]);
    setMessage(null);
  }

  function clearField() {
    setValue("");
    setCoords(null);
    setMatches([]);
    setMessage(null);
  }

  const located = coords != null;

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {latName && <input type="hidden" name={latName} value={coords?.lat ?? ""} />}
      {lonName && <input type="hidden" name={lonName} value={coords?.lon ?? ""} />}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            name={name}
            type="text"
            required={required}
            placeholder={placeholder}
            value={value}
            autoComplete="off"
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls={listboxId}
            onChange={(e) => {
              setValue(e.target.value);
              setCoords(null);
              setMatches([]);
              setMessage(null);
            }}
            onKeyDown={(e) => {
              // Enter searches; it must not submit the surrounding form.
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              } else if (e.key === "Escape") setMatches([]);
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {value && (
            <button
              type="button"
              onClick={clearField}
              aria-label="Clear address"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          {matches.map((m) => {
            const [first, ...rest] = m.address.split(",");
            return (
              <li key={`${m.lat},${m.lon}`} role="option" aria-selected={false}>
                <button type="button" onClick={() => pick(m)} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent/10">
                  <span className="block font-medium">{first}</span>
                  {rest.length > 0 && <span className="block text-xs text-muted">{rest.join(",").trim()}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <p role="status" className="mt-1.5 text-xs text-danger">
          {message}
        </p>
      )}
      {!message && value.trim() && !located && matches.length === 0 && (
        <p className="mt-1.5 text-xs text-muted">Not located yet: press Search (or Enter) and pick the match.</p>
      )}
      {located && !resetOnPick && <p className="mt-1.5 text-xs text-success">✓ Located</p>}
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {kind === "personal"
          ? "Only the address is looked up, on our own servers with U.S. Census Bureau data (not endorsed or certified by the Census Bureau). No names are sent."
          : "Address lookup: our own geocoder (U.S. Census Bureau data, not endorsed or certified by the Census Bureau), Geoapify and © OpenStreetMap contributors."}
      </p>
    </div>
  );
}
