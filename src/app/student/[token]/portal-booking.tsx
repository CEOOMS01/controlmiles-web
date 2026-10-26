"use client";

// Driving school portal: book a lesson, cancel one, text reminders
// (2026-10-19, phase 2).

import { useMemo, useState, useTransition } from "react";
import { AgendaGrid, type AgendaItem, type AgendaShade } from "@/components/agenda-grid";
import { bookSlot, cancelLesson, getSlots, setSms, type GridCell, type Slot } from "./actions";
import { DATE_LOCALE, STR, fill, type Lang } from "./strings";

/** A lesson this student already has, drawn on the calendar. */
export type MineLesson = { id: string; date: string; start: string; end: string; late: boolean };

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const dayFor = (lang: Lang) => (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(DATE_LOCALE[lang], { weekday: "short", month: "short", day: "numeric" });
const btn = "rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent disabled:opacity-50";
const primary = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50";

export function BookLesson({
  token,
  policy,
  lang,
  noHours = false,
  mine = [],
}: {
  token: string;
  policy: string | null;
  lang: Lang;
  /** The school sells hours and none are left: say so before showing times. */
  noHours?: boolean;
  mine?: MineLesson[];
}) {
  const S = STR[lang];
  const day = dayFor(lang);
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [language, setLanguage] = useState<"en" | "es" | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      setError(null);
      const r = await getSlots(token);
      if (!r) return setError(S.unavailable);
      setMinutes(r.minutes);
      setLanguage(r.language ?? null);
      setSlots(r.slots);
      setGrid(r.grid ?? []);
      setOpen(true);
    });

  const confirm = () =>
    chosen &&
    start(async () => {
      const r = await bookSlot(token, chosen, lang);
      if (r.error) {
        setError(r.error);
        setChosen(null);
        const again = await getSlots(token);
        if (again) {
          setSlots(again.slots);
          setGrid(again.grid ?? []);
        }
        return;
      }
      setDone(fill(S.booked, { day: day(chosen.date), time: time12(chosen.start) }));
      setChosen(null);
      setOpen(false);
    });

  const days = [...new Set((slots ?? []).map((s) => s.date))];
  // One day at a time (Calendly / Acuity style): the confirmation sits right
  // under the times instead of after every day of the next weeks.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const shownDay = pickedDay && days.includes(pickedDay) ? pickedDay : (days[0] ?? null);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{S.bookTitle}</h2>
        {!open && !noHours && (
          <button type="button" onClick={load} disabled={pending} className={primary}>
            {pending ? S.loading : S.seeTimes}
          </button>
        )}
      </div>
      {noHours && <p className="mt-2 text-sm text-muted">{S.noHoursLeft}</p>}
      {done && <p className="mt-2 text-sm text-success">{done}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {open && slots && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            {fill(S.minuteLessons, { n: minutes })}
            {language ? fill(S.withInstructor, { lang: language === "es" ? S.langEs : S.langEn }) : ""}.
            {S.pickTime}
          </p>
          <div className="flex overflow-hidden rounded-lg border border-border text-sm sm:w-fit" role="group">
            {(["calendar", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`flex-1 px-4 py-1.5 sm:flex-none ${view === v ? "bg-accent text-accent-foreground" : "bg-surface hover:bg-background"}`}
              >
                {v === "calendar" ? S.viewCalendar : S.viewList}
              </button>
            ))}
          </div>
          {view === "calendar" && (
            <ClientCalendar
              token={token}
              lang={lang}
              grid={grid}
              mine={mine}
              chosen={chosen}
              onPick={(s) => {
                setChosen(s);
                setError(null);
              }}
            />
          )}
          {view === "list" && days.length === 0 && <p className="text-sm text-muted">{S.noTimes}</p>}
          {view === "list" && days.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={S.daysAria}>
              {days.map((d) => {
                const on = d === shownDay;
                const count = slots.filter((s) => s.date === d).length;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => {
                      setPickedDay(d);
                      setChosen(null);
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      on ? "border-accent bg-accent/10 font-semibold" : "border-border hover:border-accent"
                    }`}
                  >
                    <span className="block">{day(d)}</span>
                    <span className="block text-xs font-normal text-muted">
                      {count} {count === 1 ? S.oneTime : S.manyTimes}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {view === "list" && shownDay && (
            <div key={shownDay}>
              <div className="flex flex-wrap gap-2">
                {slots
                  .filter((s) => s.date === shownDay)
                  .map((s) => {
                    const sel = chosen?.date === s.date && chosen?.start === s.start;
                    return (
                      <button
                        key={`${s.date}-${s.start}`}
                        type="button"
                        onClick={() => {
                          setChosen(s);
                          setError(null);
                        }}
                        className={`${btn} ${sel ? "border-accent bg-accent/10" : ""}`}
                      >
                        {time12(s.start)}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {chosen && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
              <p className="font-medium">
                {day(chosen.date)} · {time12(chosen.start)}–{time12(chosen.end)}
              </p>
              {policy && <p className="mt-2 text-muted">{policy}</p>}
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                <span>{S.agree}</span>
              </label>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirm} disabled={pending || !agreed} className={primary}>
                  {pending ? S.booking : S.bookThis}
                </button>
                <button type="button" onClick={() => setChosen(null)} className={btn}>
                  {S.back}
                </button>
              </div>
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
            {S.close}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The client's calendar: green = free (tap to choose), gray = taken or closed
 * (lunch and other hours the school blocks). It never says who is busy.
 * The student's own lessons show in the accent color and can be cancelled.
 */
function ClientCalendar({
  token,
  lang,
  grid,
  mine,
  chosen,
  onPick,
}: {
  token: string;
  lang: Lang;
  grid: GridCell[];
  mine: MineLesson[];
  chosen: Slot | null;
  onPick: (s: Slot) => void;
}) {
  const S = STR[lang];
  // The calendar only mounts after a tap (client side), so reading the width here is safe.
  const [days] = useState(() => (window.innerWidth < 640 ? 3 : 7));

  const allDates = useMemo(() => [...new Set(grid.map((g) => g.date))].sort(), [grid]);
  const firstFree = grid.find((g) => g.status === "free")?.date ?? allDates[0];
  const [from, setFrom] = useState<string | null>(null);
  const start = from ?? firstFree;
  const [openMine, setOpenMine] = useState<string | null>(null);

  const { startMin, endMin } = useMemo(() => {
    let lo = 8 * 60;
    let hi = 17 * 60;
    for (const g of grid) {
      lo = Math.min(lo, toMin(g.start));
      hi = Math.max(hi, toMin(g.end));
    }
    return { startMin: Math.floor(lo / 60) * 60, endMin: Math.ceil(hi / 60) * 60 };
  }, [grid]);

  if (!start) return <p className="text-sm text-muted">{S.noTimes}</p>;
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const last = allDates[allDates.length - 1];

  const mineItems: AgendaItem[] = mine.map((m) => ({
    id: `mine:${m.id}`,
    date: m.date,
    start: toMin(m.start),
    end: toMin(m.end),
    title: S.yourLesson,
    tone: "mine",
    clickable: true,
  }));
  const overlapsMine = (g: GridCell) =>
    mine.some((m) => m.date === g.date && toMin(m.start) < toMin(g.end) && toMin(m.end) > toMin(g.start));
  const cellItems: AgendaItem[] = grid
    .filter((g) => !overlapsMine(g))
    .map((g) => {
      const selected = chosen?.date === g.date && chosen?.start === g.start;
      return {
        id: `${g.status}:${g.date}|${g.start}|${g.end}`,
        date: g.date,
        start: toMin(g.start),
        end: toMin(g.end),
        title:
          g.status === "free"
            ? `${time12(g.start)}${selected ? " ✓" : ""}`
            : g.status === "break"
              ? S.closedLabel
              : S.notAvailable,
        tone: g.status === "free" ? "free" : g.status === "break" ? "break" : "busy",
        clickable: g.status === "free",
      } satisfies AgendaItem;
    });

  const shades: AgendaShade[] = [];
  const picked = mine.find((m) => `mine:${m.id}` === openMine);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFrom(addDays(start, -days))}
          disabled={start <= (allDates[0] ?? start)}
          className="rounded-lg border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
        >
          ← {S.prevDays}
        </button>
        <button
          type="button"
          onClick={() => setFrom(addDays(start, days))}
          disabled={!last || addDays(start, days) > last}
          className="rounded-lg border border-border px-3 py-1.5 hover:border-accent disabled:opacity-40"
        >
          {S.nextDays} →
        </button>
      </div>
      <AgendaGrid
        dates={dates}
        startMin={startMin}
        endMin={endMin}
        items={[...cellItems, ...mineItems]}
        shades={shades}
        timeFormat="12h"
        locale={DATE_LOCALE[lang]}
        minColPx={days === 3 ? 96 : 104}
        maxHeight="60vh"
        onItemClick={(it) => {
          if (it.id.startsWith("mine:")) {
            setOpenMine((cur) => (cur === it.id ? null : it.id));
            return;
          }
          const [, key] = it.id.split(/:(.+)/);
          const [date, s, e] = key.split("|");
          setOpenMine(null);
          onPick({ date, start: s, end: e });
        }}
      />
      <p className="text-xs text-muted">{S.calendarHint}</p>
      {picked && (
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <p className="font-medium">
            {S.yourLesson} · {dayFor(lang)(picked.date)} · {time12(picked.start)}–{time12(picked.end)}
          </p>
          <div className="mt-2">
            <CancelLesson token={token} blockId={picked.id} late={picked.late} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CancelLesson({ token, blockId, late, lang }: { token: string; blockId: string; late: boolean; lang: Lang }) {
  const S = STR[lang];
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="text-xs text-danger hover:underline">
        {S.cancel}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className={late ? "text-danger" : "text-muted"}>
        {late ? S.lateCancel : S.freeCancel}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelLesson(token, blockId, lang);
            if (r.error) setError(r.error);
          })
        }
        className="rounded border border-danger px-2 py-0.5 text-danger"
      >
        {pending ? S.cancelling : S.yesCancel}
      </button>
      <button type="button" onClick={() => setAsk(false)} className="text-muted">
        {S.keepIt}
      </button>
      {error && <span className="w-full text-danger">{error}</span>}
    </span>
  );
}

export function SmsOptIn({ token, consent, phone, lang }: { token: string; consent: boolean; phone: string | null; lang: Lang }) {
  const S = STR[lang];
  const [value, setValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-sm">
      <h2 className="font-semibold">{S.smsTitle}</h2>
      {consent ? (
        <p className="mt-1 text-muted">
          {fill(S.smsOn, { phone: phone ?? "" })}{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setError((await setSms(token, false, "", lang)).error))}
            className="text-accent hover:underline"
          >
            {S.turnOff}
          </button>
          .
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="tel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={S.mobile}
            className="rounded-lg border border-border bg-background px-3 py-1.5"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setError((await setSms(token, true, value, lang)).error))}
            className={btn}
          >
            {S.textMe}
          </button>
          <p className="w-full text-xs text-muted">{S.smsConsent}</p>
        </div>
      )}
      {error && <p className="mt-1 text-danger">{error}</p>}
    </div>
  );
}
