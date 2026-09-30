// Instant feedback while an admin page renders on the server (2026-09-29,
// "Fleet tarda mucho en cargar"): without a loading boundary a sidebar click
// showed nothing until the whole page was ready, and route prefetch had to
// render every section in full. With it, the sidebar/layout stays and this
// skeleton appears at once; prefetch only needs the part above it.
export default function AdminLoading() {
  return (
    <main className="px-6 py-10 sm:px-10" aria-busy="true" aria-live="polite">
      <div className="mb-8 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-border" />
        <div className="h-7 w-56 animate-pulse rounded bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-xl border border-border bg-surface" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
