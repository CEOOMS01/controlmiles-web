// Reading every row of a query, not just the first page.
//
// PostgREST answers at most 1000 rows per request (the project default), and
// a long `.in("id", [...])` list overflows the URL. A report built from a
// capped read silently leaves students out, so reports page through the
// result and read id lists in chunks. Any error is thrown: a report must
// fail loudly, never come out short.
//
// Every paged query needs a stable `.order(...)` ending in a unique column,
// or rows can repeat or go missing between pages.

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export const PAGE_SIZE = 1000;

export async function selectAll<T = Record<string, unknown>>(
  run: (from: number, to: number) => Page<T>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Like selectAll for `.in("col", ids)`, with the id list cut into chunks. */
export async function selectAllIn<T = Record<string, unknown>>(
  ids: string[],
  run: (chunk: string[], from: number, to: number) => Page<T>,
  chunkSize = 100,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    out.push(...(await selectAll<T>((from, to) => run(chunk, from, to))));
  }
  return out;
}
