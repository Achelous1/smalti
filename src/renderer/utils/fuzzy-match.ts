/**
 * Case-insensitive subsequence match ("fzf-style").
 *
 * Returns a score (lower = better) or null when the query is not a
 * subsequence of the text. The score prefers tighter spans (fewer gaps
 * between matched characters) and earlier first-match positions.
 */
export function fuzzyMatch(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let searchFrom = 0;
  let first = -1;
  let last = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], searchFrom);
    if (idx === -1) return null;
    if (first === -1) first = idx;
    last = idx;
    searchFrom = idx + 1;
  }
  const gaps = last - first - (q.length - 1);
  return gaps * 2 + first;
}

/**
 * Filter and rank items by the best fuzzy score across each item's keys.
 * Items with no matching key are dropped; ties keep their original order.
 */
export function fuzzyFilter<T>(items: T[], query: string, keys: (item: T) => string[]): T[] {
  if (!query) return items;
  return items
    .map((item) => {
      let best: number | null = null;
      for (const key of keys(item)) {
        const score = fuzzyMatch(key, query);
        if (score !== null && (best === null || score < best)) best = score;
      }
      return { item, best };
    })
    .filter((entry): entry is { item: T; best: number } => entry.best !== null)
    .sort((a, b) => a.best - b.best)
    .map((entry) => entry.item);
}
