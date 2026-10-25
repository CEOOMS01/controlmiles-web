"use client";

// Address field (2026-10-24/25). The address is looked up on OUR server
// (src/lib/geocode.ts), which decides which service may receive it:
//
//   kind="personal"  student home address -> our own geocoder (Census data) only
//   kind="place"     school / depot / stop -> cache, own geocoder, Census, Geoapify/Nominatim
//
// Two looks, same contract (a text input called `name` plus optional hidden
// latitude/longitude inputs, so the server actions need no changes):
//
//   plain       one text box + Search button (route builder, origin/destination)
//   structured  street / apt / city / state / ZIP fields; suggestions drop down from the street field
//               fields; the saved text is the fields joined into one line
//
// Searching starts by itself when the person pauses typing; only our own
// server sees the text, and a late answer to older text is dropped. The notice
// about where the address goes lives behind a "?" button.

import { useEffect, useId, useRef, useState } from "react";
import { searchAddress } from "../geocode-actions";

type Match = { address: string; lat: number; lon: number; city?: string };
type Fields = { street: string; apt: string; city: string; st: string; zip: string };

const STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  );
const EMPTY: Fields = { street: "", apt: "", city: "", st: "", zip: "" };
const STREET_START = /^\d+\s+\S{3,}/;

/** "123 Main St, Baltimore, MD 21211" or "123 Main St, 21211, MD" -> fields. */
function parseAddress(text: string | null | undefined, city?: string): Fields {
  const parts = String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const f: Fields = { ...EMPTY, street: parts[0] ?? "", city: city ?? "" };
  for (const p of parts.slice(1)) {
    const stZip = /^([A-Za-z]{2})(?:\s+(\d{5})(?:-\d{4})?)?$/.exec(p);
    if (stZip && STATES.includes(stZip[1].toUpperCase())) {
      f.st = stZip[1].toUpperCase();
      if (stZip[2]) f.zip = stZip[2];
    } else if (/^\d{5}(-\d{4})?$/.test(p)) f.zip = p.slice(0, 5);
    else if (!f.city) f.city = p;
  }
  return f;
}

/** One line to save (with the apartment) or to look up (without it). */
function compose(f: Fields, withApt: boolean): string {
  const line1 = [f.street.trim(), withApt ? f.apt.trim() : ""].filter(Boolean).join(" ");
  return [line1, f.city.trim(), [f.st, f.zip.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

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
  structured = false,
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
  /** Street / apt / city / state / ZIP fields instead of one text box. */
  structured?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [fields, setFields] = useState<Fields>(() => (structured ? parseAddress(defaultValue) : EMPTY));
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(defaultCoords ?? null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const infoId = useId();
  const seq = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMatches([]);
        setInfoOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // What the geocoder gets: in the structured look, the fields without the apartment.
  const lookup = structured ? compose(fields, false) : value;
  const saved = structured ? compose(fields, true) : value;

  async function search(text: string, auto: boolean) {
    if (loading && !auto) return;
    const mine = ++seq.current;
    setMessage(null);
    setMatches([]);
    if (text.trim().length < 5) return setMessage("Type the street number, street and city, then search.");
    setLoading(true);
    try {
      const r = await searchAddress(text, kind);
      if (mine !== seq.current) return;
      if (r.error) setMessage(r.error);
      else if (r.results.length === 0) {
        // While typing, "no match" is noise: only say it when asked.
        if (auto) return;
        setMessage(
          kind === "personal"
            ? "No match. Check the street number and city, or leave out the apartment. You can still save it and fix it later."
            : "No match. Check the spelling, or add the city and state.",
        );
      } else if (r.results.length === 1 && !r.note && (structured || !auto)) pick(r.results[0], false);
      else {
        setMatches(r.results);
        if (r.note) setMessage(r.note);
      }
    } catch {
      setMessage("The address search is not available right now. Try again in a moment.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  // Search by itself when the person pauses typing (no ZIP needed).
  useEffect(() => {
    if (coords || !STREET_START.test(lookup.trim()) || lookup.trim().length < 8) return;
    const t = setTimeout(() => void search(lookup, true), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookup]);
  // The surrounding form was reset (it saved): empty these controlled fields too.
  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      seq.current++;
      setLoading(false);
      setValue(defaultValue ?? "");
      setFields(structured ? parseAddress(defaultValue) : EMPTY);
      setCoords(defaultCoords ?? null);
      setMatches([]);
      setMessage(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** overwrite: the person chose this match, so it replaces the fields; otherwise it only fills empty ones. */
  function pick(m: Match, overwrite = true) {
    seq.current++;
    setLoading(false);
    onPick?.({ address: m.address, lat: m.lat, lon: m.lon });
    if (structured) {
      const p = parseAddress(m.address, m.city);
      setFields((f) =>
        overwrite
          ? { ...p, apt: f.apt, city: p.city || f.city }
          : { ...f, city: f.city || p.city, st: f.st || p.st, zip: f.zip || p.zip },
      );
    } else setValue(resetOnPick ? "" : m.address);
    setCoords(resetOnPick ? null : { lat: m.lat, lon: m.lon });
    setMatches([]);
    setMessage(null);
  }

  function clearField() {
    seq.current++;
    setValue("");
    setFields(EMPTY);
    setCoords(null);
    setMatches([]);
    setMessage(null);
  }

  function edited() {
    seq.current++;
    setLoading(false);
    setCoords(null);
    setMatches([]);
    setMessage(null);
  }

  function setField(k: keyof Fields, v: string) {
    // The apartment is not part of the lookup, so it must not forget the location.
    if (k !== "apt") edited();
    setFields((f) => ({ ...f, [k]: v }));
  }

  const located = coords != null;
  const inputBase =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
  const smallLabel = "mb-1 block text-xs text-muted";

  const notice =
    kind === "personal"
      ? "Only the address is looked up, on our own servers with U.S. Census Bureau data (not endorsed or certified by the Census Bureau). No names are sent."
      : "Address lookup: our own geocoder (U.S. Census Bureau data, not endorsed or certified by the Census Bureau), Geoapify and © OpenStreetMap contributors.";

  const list =
    matches.length > 0 ? (
      <ul
        id={listboxId}
        role="listbox"
        className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      >
        {matches.map((m) => {
          const [first, ...restParts] = m.address.split(",");
          const rest = [m.city, ...restParts.map((x) => x.trim())].filter(Boolean);
          return (
            <li key={`${m.lat},${m.lon}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(m)} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent/10">
                <span className="block font-medium">{first}</span>
                {rest.length > 0 && <span className="block text-xs text-muted">{rest.join(", ")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  const clearButton = (
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
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-sm font-medium">{label}</label>
        <button
          type="button"
          onClick={() => setInfoOpen((o) => !o)}
          aria-expanded={infoOpen}
          aria-controls={infoId}
          aria-label="Where does this address go?"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none font-semibold text-muted hover:border-accent hover:text-foreground"
        >
          ?
        </button>
      </div>
      {infoOpen && (
        <p id={infoId} role="note" className="mb-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-snug text-muted">
          {notice}
        </p>
      )}
      {latName && <input type="hidden" name={latName} value={coords?.lat ?? ""} />}
      {lonName && <input type="hidden" name={lonName} value={coords?.lon ?? ""} />}

      {structured ? (
        <div>
          <input type="hidden" name={name} value={saved} />
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2.5">
            <div className="relative">
              <label className={smallLabel}>Street address</label>
              <input
                type="text"
                required={required}
                value={fields.street}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={matches.length > 0}
                aria-controls={listboxId}
                onChange={(e) => setField("street", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void search(lookup, false);
                  } else if (e.key === "Escape") setMatches([]);
                }}
                className={inputBase}
              />
              {list}
            </div>
            <div>
              <label className={smallLabel}>Apt, unit (optional)</label>
              <input type="text" value={fields.apt} autoComplete="off" onChange={(e) => setField("apt", e.target.value)} className={inputBase} />
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
            <div>
              <label className={smallLabel}>City</label>
              <input type="text" value={fields.city} autoComplete="off" onChange={(e) => setField("city", e.target.value)} className={inputBase} />
            </div>
            <div>
              <label className={smallLabel}>State</label>
              <select value={fields.st} onChange={(e) => setField("st", e.target.value)} className={inputBase}>
                <option value="">—</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={smallLabel}>ZIP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={fields.zip}
                autoComplete="off"
                onChange={(e) => setField("zip", e.target.value.replace(/\D/g, ""))}
                className={inputBase}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void search(lookup, false)}
              disabled={loading}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accent disabled:opacity-60"
            >
              {loading ? "Searching…" : "Locate on map"}
            </button>
            {fields.street && (
              <button type="button" onClick={clearField} className="text-xs text-muted hover:text-foreground">
                Clear
              </button>
            )}
          </div>
        </div>
      ) : (
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
                edited();
                setValue(e.target.value);
              }}
              onKeyDown={(e) => {
                // Enter searches; it must not submit the surrounding form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search(value, false);
                } else if (e.key === "Escape") setMatches([]);
              }}
              className={inputBase + " pr-8"}
            />
            {value && clearButton}
            {list}
          </div>
          <button
            type="button"
            onClick={() => void search(value, false)}
            disabled={loading}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-1.5 text-xs text-danger">
          {message}
        </p>
      )}
      {!message && !located && matches.length === 0 && (structured ? lookup.trim() : value.trim()) && (
        <p className="mt-1.5 text-xs text-muted">
          {structured ? "Not located yet: it is looked up when you stop typing, or press Locate on map." : "Not located yet: press Search (or Enter) and pick the match."}
        </p>
      )}
      {located && !resetOnPick && <p className="mt-1.5 text-xs text-success">✓ Located</p>}
    </div>
  );
}
