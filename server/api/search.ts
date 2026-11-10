import type { TmdbItem } from "../tmdb/types";
import { fail, type Ctx } from "./http";

export type MediaType = "movie" | "tv";

export type SearchResult = {
  id: number;
  mediaType: MediaType;
  title: string;
  year: string | null;
  posterPath: string | null;
};

function toResult(i: TmdbItem, fallback?: MediaType): SearchResult | null {
  const type = i.media_type ?? fallback;
  if (type !== "movie" && type !== "tv") return null;
  const date = type === "movie" ? i.release_date : i.first_air_date;
  return {
    id: i.id,
    mediaType: type,
    title: (type === "movie" ? i.title : i.name) ?? "",
    year: date?.slice(0, 4) || null,
    posterPath: i.poster_path ?? null,
  };
}

async function results(ctx: Ctx, path: string, params: Record<string, string>, fallback?: MediaType) {
  try {
    const items = await ctx.tmdb.list(path, params);
    return Response.json({ results: items.map((i) => toResult(i, fallback)).filter((r) => r !== null) });
  } catch {
    return fail(502, "TMDB request failed");
  }
}

/** GET /api/search?q= */
export const search = (ctx: Ctx, q: string) =>
  q ? results(ctx, "/search/multi", { query: q, include_adult: "false" }) : Response.json({ results: [] });

/** GET /api/trending/:type */
export const trending = (ctx: Ctx, type: MediaType) => results(ctx, `/trending/${type}/week`, {}, type);
