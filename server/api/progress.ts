import { CONTINUE_LIMIT, type Progress } from "../progress/store";
import { fail, noContent, notFound, type Ctx } from "./http";
import type { MediaType } from "./search";
import { nextFor } from "./series";

/** Season 0 is specials; episodes count from 1. */
const validEpisode = (season: unknown, episode: unknown) =>
  Number.isInteger(season) && (season as number) >= 0 && Number.isInteger(episode) && (episode as number) >= 1;

const invalid = () => fail(400, "Invalid progress");

/** GET /api/progress?mediaType=&id=[&season=&episode=] */
export async function getProgress(ctx: Ctx, q: URLSearchParams) {
  const mediaType = q.get("mediaType");
  const id = Number(q.get("id"));
  const season = q.has("season") ? Number(q.get("season")) : null;
  const episode = q.has("episode") ? Number(q.get("episode")) : null;
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(id) || (mediaType === "tv" && !validEpisode(season, episode))) return invalid();
  const p = await ctx.progress.get({ mediaType, tmdbId: id, season, episode });
  return Response.json({ progress: p && { position: p.position, duration: p.duration, finished: p.finished } });
}

/** POST /api/progress. Read as text so `sendBeacon` (text/plain) works too. */
export async function saveProgress(ctx: Ctx, req: Request) {
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(await req.text());
  } catch {
    return fail(400, "Invalid JSON");
  }
  const { mediaType, tmdbId, season, episode, position, duration } = b ?? {};
  if (
    (mediaType !== "movie" && mediaType !== "tv") ||
    !Number.isInteger(tmdbId) ||
    (mediaType === "tv" && !validEpisode(season, episode)) ||
    typeof position !== "number" || !Number.isFinite(position) || position < 0 ||
    typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0
  )
    return invalid();
  await ctx.progress.save({
    mediaType,
    tmdbId: tmdbId as number,
    ...(mediaType === "tv" && { season: season as number, episode: episode as number }),
    position,
    duration,
  });
  return noContent();
}

/** One Continue watching card, or null when a series has nothing left to watch. */
async function continueCard(ctx: Ctx, p: Progress) {
  if (p.mediaType === "movie") {
    const m = await ctx.tmdb.movie(p.tmdbId);
    return {
      id: p.tmdbId,
      mediaType: "movie" as const,
      title: m.title ?? "",
      year: m.release_date?.slice(0, 4) || null,
      posterPath: m.poster_path ?? null,
      backdropPath: m.backdrop_path ?? null,
      position: p.position,
      duration: p.duration,
    };
  }
  const t = await ctx.tmdb.tv(p.tmdbId);
  const next = await nextFor(ctx, t, p);
  if (!next) return null;
  const saved = await ctx.progress.get({ mediaType: "tv", tmdbId: p.tmdbId, ...next });
  const started = saved && !saved.finished ? saved : null;
  return {
    id: p.tmdbId,
    mediaType: "tv" as const,
    title: t.name ?? "",
    year: t.first_air_date?.slice(0, 4) || null,
    posterPath: t.poster_path ?? null,
    backdropPath: t.backdrop_path ?? null,
    ...next,
    position: started?.position ?? 0,
    duration: started?.duration ?? 0,
  };
}

/** GET /api/continue */
export async function continueWatching(ctx: Ctx) {
  // A TMDB blip drops a card for now; its progress row stays.
  const cards = await Promise.all((await ctx.progress.continueWatching()).map((p) => continueCard(ctx, p).catch(() => null)));
  return Response.json({ results: cards.filter((c) => c !== null).slice(0, CONTINUE_LIMIT) });
}

/** DELETE /api/continue/:type/:id */
export const hide = async (ctx: Ctx, mediaType: MediaType, tmdbId: number) =>
  (await ctx.progress.hide({ mediaType, tmdbId })) ? noContent() : notFound();
