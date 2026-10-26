"use client";

// The time grid behind both agendas (2026-10-26): the school's big calendar
// (every class with student / instructor / car) and the client's booking
// calendar (only free / not available times). It draws days as columns and the
// hours as rows; what goes in it, and what a click or a drop does, is up to the
// caller. Overlapping items sit side by side. Dragging an item and dropping it
// on another time calls onDropItem; touch screens have no drag, so callers also
// give a click path (onItemClick) that opens the same move form.

import { useRef, useState, type CSSProperties } from "react";

export type AgendaTone = "class" | "mine" | "free" | "busy" | "break" | "done" | "cancelled" | "missed";

export type AgendaItem = {
  id: string;
  date: string; // YYYY-MM-DD
  start: number; // minutes from midnight
  end: number;
  title: string;
  subtitle?: string;
  tone: AgendaTone;
  draggable?: boolean;
  clickable?: boolean;
};

export type AgendaShade = {
  date: string;
  start: number;
  end: number;
  kind: "closed" | "break";
  label?: string;
};

const TONE: Record<AgendaTone, string> = {
  class: "border-accent/50 bg-accent/15 text-foreground",
  mine: "border-accent bg-accent text-accent-foreground",
  free: "border-success/50 bg-success/10 text-success hover:bg-success/20",
  busy: "border-transparent bg-border/50 text-muted",
  break: "border-transparent text-muted",
  done: "border-success/50 bg-success/15 text-foreground",
  cancelled: "border-border bg-background text-muted line-through",
  missed: "border-danger/50 bg-danger/10 text-foreground",
};

const HATCH: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, currentColor 14%, transparent) 6px 7px)",
};

export function fmtMinutes(min: number, format: "12h" | "24h"): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  if (format === "24h") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** Side-by-side lanes for overlapping items: lane index and how many lanes share its time. */
function layout(items: AgendaItem[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  let clusterEnd = -1;
  for (const it of sorted) {
    if (cluster.length > 0 && it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

const dayLabel = (d: string, locale: string) => {
  const date = new Date(`${d}T12:00:00`);
  return {
    dow: date.toLocaleDateString(locale, { weekday: "short" }),
    md: date.toLocaleDateString(locale, { month: "short", day: "numeric" }),
  };
};

export function AgendaGrid({
  dates,
  startMin,
  endMin,
  items,
  shades = [],
  today,
  timeFormat,
  locale = "en-US",
  stepMin = 15,
  hourPx = 56,
  minColPx = 84,
  onEmptyClick,
  onItemClick,
  onDropItem,
  maxHeight,
}: {
  dates: string[];
  startMin: number;
  endMin: number;
  items: AgendaItem[];
  shades?: AgendaShade[];
  today?: string;
  timeFormat: "12h" | "24h";
  locale?: string;
  stepMin?: number;
  hourPx?: number;
  minColPx?: number;
  onEmptyClick?: (date: string, minute: number) => void;
  onItemClick?: (item: AgendaItem) => void;
  onDropItem?: (item: AgendaItem, date: string, minute: number) => void;
  /** Omit to show every hour (the page scrolls); only horizontal scroll on narrow screens. */
  maxHeight?: string;
}) {
  const pxPerMin = hourPx / 60;
  const height = (endMin - startMin) * pxPerMin;
  const hours: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) hours.push(m);
  const grab = useRef(0);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const minuteAt = (e: { clientY: number }, col: HTMLElement, offsetMin = 0) => {
    const y = e.clientY - col.getBoundingClientRect().top;
    const raw = startMin + y / pxPerMin - offsetMin;
    const snapped = Math.round(raw / stepMin) * stepMin;
    return Math.max(startMin, Math.min(endMin - stepMin, snapped));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface" style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}>
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${dates.length}, minmax(${minColPx}px, 1fr))`, minWidth: 52 + dates.length * minColPx }}>
        {/* header */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface" />
        {dates.map((d) => {
          const l = dayLabel(d, locale);
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`sticky top-0 z-20 border-b border-l border-border bg-surface px-2 py-2 text-center text-xs ${isToday ? "font-semibold text-accent" : "text-muted"}`}
            >
              <span className="block">{l.dow}</span>
              <span className={`block text-sm ${isToday ? "text-accent" : "text-foreground"}`}>{l.md}</span>
            </div>
          );
        })}

        {/* time axis */}
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span
              key={m}
              className={`absolute right-1.5 text-[10px] text-muted ${m === startMin ? "" : "-translate-y-1/2"}`}
              style={{ top: (m - startMin) * pxPerMin + (m === startMin ? 2 : 0) }}
            >
              {fmtMinutes(m, timeFormat)}
            </span>
          ))}
        </div>

        {/* day columns */}
        {dates.map((d) => {
          const dayItems = items.filter((i) => i.date === d);
          const lanes = layout(dayItems);
          return (
            <div
              key={d}
              className={`relative border-l border-border ${dragOver === d ? "bg-accent/5" : ""} ${onEmptyClick ? "cursor-pointer" : ""}`}
              style={{
                height,
                backgroundImage: "linear-gradient(to bottom, var(--color-border, #e5e7eb) 1px, transparent 1px)",
                backgroundSize: `100% ${hourPx}px`,
              }}
              onClick={(e) => {
                if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.shade) return;
                onEmptyClick?.(d, minuteAt(e, e.currentTarget));
              }}
              onDragOver={(e) => {
                if (!onDropItem) return;
                e.preventDefault();
                setDragOver(d);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === d ? null : cur))}
              onDrop={(e) => {
                setDragOver(null);
                if (!onDropItem) return;
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const item = items.find((i) => i.id === id);
                if (item) onDropItem(item, d, minuteAt(e, e.currentTarget, grab.current));
              }}
            >
              {shades
                .filter((s) => s.date === d && s.end > startMin && s.start < endMin)
                .map((s, i) => {
                  const top = (Math.max(s.start, startMin) - startMin) * pxPerMin;
                  const h = (Math.min(s.end, endMin) - Math.max(s.start, startMin)) * pxPerMin;
                  return (
                    <div
                      key={i}
                      data-shade="1"
                      className={`absolute inset-x-0 overflow-hidden px-1.5 py-0.5 text-[10px] ${s.kind === "break" ? "bg-warning/5 text-warning" : "bg-border/30 text-muted"}`}
                      style={{ top, height: h, ...HATCH }}
                    >
                      {s.label}
                    </div>
                  );
                })}

              {dayItems.map((it) => {
                const pos = lanes.get(it.id) ?? { lane: 0, lanes: 1 };
                const top = (Math.max(it.start, startMin) - startMin) * pxPerMin;
                const h = Math.max(16, (Math.min(it.end, endMin) - Math.max(it.start, startMin)) * pxPerMin - 2);
                const interactive = it.clickable ?? !!onItemClick;
                return (
                  <div
                    key={it.id}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    draggable={!!it.draggable && !!onDropItem}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", it.id);
                      e.dataTransfer.effectAllowed = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      grab.current = (e.clientY - rect.top) / pxPerMin;
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (interactive) onItemClick?.(it);
                    }}
                    onKeyDown={(e) => {
                      if (interactive && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onItemClick?.(it);
                      }
                    }}
                    className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${TONE[it.tone]} ${interactive ? "cursor-pointer" : ""} ${it.draggable && onDropItem ? "cursor-grab active:cursor-grabbing" : ""}`}
                    style={{
                      top,
                      height: h,
                      left: `calc(${(pos.lane / pos.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / pos.lanes}% - 4px)`,
                      ...(it.tone === "break" ? HATCH : {}),
                    }}
                    title={[it.title, it.subtitle].filter(Boolean).join(" · ")}
                  >
                    <span className="block truncate font-medium">{it.title}</span>
                    {it.subtitle && h > 30 && <span className="block truncate opacity-80">{it.subtitle}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
