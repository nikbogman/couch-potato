/**
 * The title another app (unreel) means by a name, a year and maybe a type: the
 * first search result of that type whose year is within one of the given year
 * (release dates differ by country), or the first of that type when no year is
 * given. null when nothing fits, so the caller can fall back to search.
 */
export function bestMatch<T extends { mediaType: "movie" | "tv"; year: string | null }>(results: T[], type: "movie" | "tv" | null, year: string | null): T | null {
  const ofType = type ? results.filter((r) => r.mediaType === type) : results;
  if (!year) return ofType[0] ?? null;
  const y = Number(year);
  return ofType.find((r) => r.year !== null && Math.abs(Number(r.year) - y) <= 1) ?? null;
}
