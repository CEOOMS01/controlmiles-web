// A student's transport needs as small colored codes (2026-11-21). Hover or long-press shows what a code means.
// Server-safe: no state. Shown only where staff already see the student (students list, route pages).

import { GROUP_CHIP, type StudentNeeds } from "@/lib/school-needs";

export function NeedChips({ v, showNote = true }: { v: StudentNeeds | undefined; showNote?: boolean }) {
  if (!v || (v.needs.length === 0 && !v.program && !v.note)) return <span className="text-muted">—</span>;
  const chip = "rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none";
  return (
    <span className="flex flex-wrap items-center gap-1">
      {v.program && (
        <span title={`Program: ${v.program.label}`} className={`${chip} ${GROUP_CHIP.program}`}>
          {v.program.code}
        </span>
      )}
      {v.needs.map((n) => (
        <span key={n.id} title={`${n.code}: ${n.label}`} className={`${chip} ${GROUP_CHIP[n.grp]}`}>
          {n.code}
        </span>
      ))}
      {showNote && v.note && <span className="text-xs text-muted">{v.note}</span>}
    </span>
  );
}
