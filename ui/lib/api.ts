import type { Target } from "../../shared/types";

export type SearchResult = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  posterPath: string | null;
};

export async function searchTitles(q: string): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  return ((await res.json()) as { results: SearchResult[] }).results;
}

export const posterUrl = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

export async function fetchTrending(kind: "movie" | "tv"): Promise<SearchResult[]> {
  const res = await fetch(`/api/trending/${kind}`);
  if (!res.ok) throw new Error("Trending failed");
  return ((await res.json()) as { results: SearchResult[] }).results;
}

export type MovieDetails = {
  id: number;
  title: string;
  year: string | null;
  runtime: number | null;
  /** "8.4", or null with no votes. */
  rating: string | null;
  genres: string[];
  overview: string;
  backdropPath: string | null;
};

export async function fetchMovie(id: string): Promise<MovieDetails> {
  const res = await fetch(`/api/movie/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(res.status === 404 ? "Movie not found" : "Couldn't load movie");
  return (await res.json()) as MovieDetails;
}

export const backdropUrl = (path: string, size = "w1280") => `https://image.tmdb.org/t/p/${size}${path}`;

export type Progress = { position: number; duration: number; finished: boolean };

export async function fetchProgress(t: Target): Promise<Progress | null> {
  const q = new URLSearchParams({ mediaType: t.mediaType, id: String(t.id) });
  if (t.mediaType === "tv") {
    q.set("season", String(t.season));
    q.set("episode", String(t.episode));
  }
  const res = await fetch(`/api/progress?${q}`);
  if (!res.ok) throw new Error("Couldn't load progress");
  return ((await res.json()) as { progress: Progress | null }).progress;
}

/** Fire-and-forget save. `keepalive` lets it finish while the page is unloading. Failures are ignored: the banner covers a dead player, and the next save retries. */
export async function saveProgress(t: Target, { position, duration }: { position: number; duration: number }) {
  try {
    await fetch("/api/progress", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({ ...t, tmdbId: Number(t.id), id: undefined, position, duration }),
    });
  } catch {}
}

/** A movie, or a series pointing at its next episode (`position`/`duration` are 0 until that episode is started). */
export type ContinueItem = SearchResult & { backdropPath: string | null; position: number; duration: number; season?: number; episode?: number };

export async function fetchContinue(): Promise<ContinueItem[]> {
  const res = await fetch("/api/continue");
  if (!res.ok) throw new Error("Continue watching failed");
  return ((await res.json()) as { results: ContinueItem[] }).results;
}

export async function removeFromContinue(r: Pick<SearchResult, "mediaType" | "id">) {
  const res = await fetch(`/api/continue/${r.mediaType}/${r.id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error("Remove failed");
}

export type SeriesDetails = {
  id: number;
  title: string;
  years: string | null;
  genres: string[];
  rating: string | null;
  /** The first network TMDB lists ("Apple TV+"). */
  network: string | null;
  overview: string;
  backdropPath: string | null;
  seasons: { season: number; name: string; episodeCount: number }[];
  /** The episode Play starts: where you left off, or the next one. Null when nothing has aired. */
  next: { season: number; episode: number; progress: { position: number; duration: number } | null } | null;
};

export async function fetchSeries(id: string): Promise<SeriesDetails> {
  const res = await fetch(`/api/tv/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(res.status === 404 ? "Series not found" : "Couldn't load series");
  return (await res.json()) as SeriesDetails;
}

export type EpisodeSummary = {
  episode: number;
  name: string;
  runtime: number | null;
  overview: string;
  stillPath: string | null;
  progress: Progress | null;
};

export async function fetchSeason(id: string, season: number): Promise<EpisodeSummary[]> {
  const res = await fetch(`/api/tv/${encodeURIComponent(id)}/season/${season}`);
  if (!res.ok) throw new Error("Couldn't load episodes");
  return ((await res.json()) as { episodes: EpisodeSummary[] }).episodes;
}

/** The aired episode after this one: the rest of its season, else the first of the next season that has any. Null at the end. */
export async function fetchNextEpisode(t: Extract<Target, { mediaType: "tv" }>): Promise<{ season: number; episode: number } | null> {
  const id = String(t.id);
  const first = (eps: EpisodeSummary[], after = 0) => eps.map((e) => e.episode).filter((n) => n > after).sort((a, b) => a - b)[0];
  const here = first(await fetchSeason(id, t.season), t.episode);
  if (here !== undefined) return { season: t.season, episode: here };
  const { seasons } = await fetchSeries(id);
  for (const s of seasons.filter((s) => s.season > Math.max(t.season, 0)).sort((a, b) => a.season - b.season)) {
    const ep = first(await fetchSeason(id, s.season));
    if (ep !== undefined) return { season: s.season, episode: ep };
  }
  return null;
}
