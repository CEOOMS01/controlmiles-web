"use client";

// Address autocomplete, free and keyless: Photon (https://photon.komoot.io),
// a geocoder built on OpenStreetMap data by Komoot. No API key/billing
// account needed -- same reasoning already used for the mobile app's live
// map (flutter_map + OpenStreetMap tiles instead of Google Maps). Debounced
// client-side fetch so typing quickly doesn't spam the public instance;
// still a plain text <input name=...> under the hood so the existing
// addRoute server action needs no changes.
//
// UX modeled on the evidence-based patterns Uber/Verizon-Connect-class
// products actually use (Baymard Institute's autocomplete research: only
// 19% of implementations get every one of these right) rather than a bare
// list-of-strings dropdown: primary/secondary line split (street vs.
// city/state, the way Uber separates a venue name from its address),
// full keyboard navigation (Up/Down/Enter/Escape, ARIA combobox pattern),
// an active-result highlight, a clear (x) button, and a real "no matches"
// state instead of silently showing nothing.

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = {
  primary: string;
  secondary: string;
  lat: number;
  lon: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

function toSuggestion(f: PhotonFeature): Suggestion {
  const p = f.properties;
  const primary = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name || "";
  const secondary = [p.city, p.state, p.country].filter(Boolean).join(", ");
  return {
    primary: primary || secondary || "Unknown location",
    secondary: primary ? secondary : "",
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  };
}

function fullLabel(s: Suggestion): string {
  return [s.primary, s.secondary].filter(Boolean).join(", ");
}

export function AddressAutocompleteInput({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function runSearch(query: string) {
    // Cancel any in-flight request first -- without this, a slower earlier
    // keystroke's response can resolve AFTER a faster later one and
    // overwrite it with stale suggestions (a real race condition, not
    // just a hypothetical one on a public API with variable latency).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("geocoder request failed");
        return res.json() as Promise<{ features: PhotonFeature[] }>;
      })
      .then((data) => {
        setSuggestions(data.features.map(toSuggestion));
        setSearched(true);
        setOpen(true);
        setActiveIndex(-1);
      })
      .catch((err) => {
        // AbortError means a newer keystroke superseded this request --
        // not a real failure, so it shouldn't flash a "no results" state.
        if (err?.name === "AbortError") return;
        setSuggestions([]);
        setSearched(true);
      })
      .finally(() => setLoading(false));
  }

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 3) {
      abortRef.current?.abort();
      setSuggestions([]);
      setSearched(false);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(next), 300);
  }

  function selectSuggestion(s: Suggestion) {
    setValue(fullLabel(s));
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }

  function clearField() {
    setValue("");
    setSuggestions([]);
    setSearched(false);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && (loading || suggestions.length > 0 || searched);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          name={name}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          required={required}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => (suggestions.length > 0 || searched) && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {value && (
          <button
            type="button"
            onClick={clearField}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {showPanel && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-xs text-muted">Searching…</li>}

          {!loading && suggestions.length === 0 && searched && (
            <li className="px-3 py-2 text-xs text-muted">
              No matches — you can still type the address manually.
            </li>
          )}

          {!loading &&
            suggestions.map((s, i) => (
              <li
                key={`${s.lat}-${s.lon}-${i}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <button
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm ${
                    i === activeIndex ? "bg-background" : ""
                  }`}
                >
                  <span className="mt-0.5 text-muted" aria-hidden="true">
                    📍
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.primary}</span>
                    {s.secondary && (
                      <span className="block truncate text-xs text-muted">{s.secondary}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
