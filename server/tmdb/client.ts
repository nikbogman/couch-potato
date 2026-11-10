// The only code that talks to TMDB (and so the only code that sees the API key). Raw TMDB shapes stay in this folder.
import type { TmdbEpisode, TmdbItem, TmdbMovie, TmdbTv } from "./types";

const BASE = "https://api.themoviedb.org/3";

/** `fetch` is injectable for tests. Every method throws an HTTP status (404 or 502), never a message that could carry the key. */
export function createTmdb(apiKey: string, fetch: typeof globalThis.fetch = globalThis.fetch) {
  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    url.search = new URLSearchParams({ api_key: apiKey, language: "en-US", ...params }).toString();
    let res: Response;
    try {
      res = await fetch(url.toString());
    } catch {
      throw 502;
    }
    if (res.status === 404) throw 404;
    if (!res.ok) throw 502;
    try {
      return (await res.json()) as T;
    } catch {
      throw 502;
    }
  }

  return {
    list: async (path: string, params?: Record<string, string>) => (await get<{ results?: TmdbItem[] }>(path, params)).results ?? [],
    movie: (id: string | number) => get<TmdbMovie>(`/movie/${id}`),
    tv: (id: string | number) => get<TmdbTv>(`/tv/${id}`),
    season: async (id: number, season: number) => (await get<{ episodes?: TmdbEpisode[] }>(`/tv/${id}/season/${season}`)).episodes ?? [],
  };
}

export type Tmdb = ReturnType<typeof createTmdb>;
