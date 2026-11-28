import { bestMatch } from "../shared/find";
import { searchTitles, type SearchResult } from "./api/search";
import type { Tmdb } from "./tmdb/client";

export type Wanted = { title: string; year: number | null; type: "movie" | "tv" };

/** Each wanted title's TMDB match (same rule as /remote/find), or null when none fits or TMDB failed. */
export function lookup(tmdb: Tmdb, wanted: Wanted[]): Promise<(SearchResult | null)[]> {
  return Promise.all(
    wanted.slice(0, 40).map((w) =>
      searchTitles(tmdb, w.title)
        .then((r) => bestMatch(r, w.type, w.year ? String(w.year) : null))
        .catch(() => null),
    ),
  );
}
