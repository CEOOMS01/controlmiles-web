"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent print:hidden"
    >
      Print / save as PDF
    </button>
  );
}
