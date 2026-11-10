// `/api/*` routing. Each route's handler lives in the file named after its resource.
import type { ProgressStore } from "../progress/store";
import { createTmdb } from "../tmdb/client";
import { notFound, type Ctx } from "./http";
import { movie } from "./movie";
import { continueWatching, getProgress, hide, saveProgress } from "./progress";
import { search, trending, type MediaType } from "./search";
import { season, series } from "./series";

export type { SearchResult } from "./search";

export function createApi({
  apiKey,
  fetch,
  progress,
  today = () => new Date().toISOString().slice(0, 10),
}: {
  apiKey: string;
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch;
  progress: ProgressStore;
  today?: () => string;
}) {
  const ctx: Ctx = { tmdb: createTmdb(apiKey, fetch), progress, today };

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    let m: RegExpMatchArray | null;

    if (path === "/api/search") return search(ctx, (url.searchParams.get("q") ?? "").trim());
    if ((m = path.match(/^\/api\/trending\/(movie|tv)$/))) return trending(ctx, m[1] as MediaType);
    if ((m = path.match(/^\/api\/movie\/(\d+)$/))) return movie(ctx, m[1]!);
    if ((m = path.match(/^\/api\/tv\/(\d+)$/))) return series(ctx, m[1]!);
    if ((m = path.match(/^\/api\/tv\/(\d+)\/season\/(\d+)$/))) return season(ctx, Number(m[1]), Number(m[2]));
    if (path === "/api/continue") return continueWatching(ctx);
    if ((m = path.match(/^\/api\/continue\/(movie|tv)\/(\d+)$/)) && req.method === "DELETE") return hide(ctx, m[1] as MediaType, Number(m[2]));
    if (path === "/api/progress") return req.method === "POST" ? saveProgress(ctx, req) : getProgress(ctx, url.searchParams);
    return notFound();
  };
}
