import type { Progress } from "../progress/store";
import type { TmdbTv } from "../tmdb/types";
import { tmdbError, type Ctx } from "./http";
import { nextEpisode, type Episode, type SeasonEpisodes } from "./nextEpisode";

/** Real seasons in order. Specials (season 0) and seasons TMDB lists with no episodes yet are left out everywhere. */
const realSeasons = (tv: TmdbTv) =>
  (tv.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count !== 0).sort((a, b) => a.season_number - b.season_number);
const seasonNumbers = (tv: TmdbTv) => realSeasons(tv).map((s) => s.season_number);

/** "2020–2022" once ended, "2022–" while running, "2022" for a single year. */
function years(tv: TmdbTv) {
  const first = tv.first_air_date?.slice(0, 4);
  if (!first) return null;
  if (tv.status !== "Ended" && tv.status !== "Canceled") return `${first}–`;
  const last = tv.last_air_date?.slice(0, 4);
  return last && last !== first ? `${first}–${last}` : first;
}

/** What to watch next in a series, or null when it is complete. Season lookups happen only when the last episode is finished. */
export async function nextFor(ctx: Ctx, tv: TmdbTv, last: Progress | null): Promise<Episode | null> {
  if (last && !last.finished) return { season: last.season!, episode: last.episode! };
  const nums = seasonNumbers(tv);
  const wanted = (last ? [last.season!, nums.find((n) => n > last.season!)] : [nums[0]]).filter((n) => n !== undefined);
  const seasons: SeasonEpisodes[] = await Promise.all(
    wanted.map(async (season) => ({
      season,
      episodes: (await ctx.tmdb.season(tv.id, season)).map((e) => ({ episode: e.episode_number, airDate: e.air_date ?? null })),
    })),
  );
  return nextEpisode(last && { season: last.season!, episode: last.episode!, finished: last.finished }, seasons, ctx.today());
}

/** GET /api/tv/:id */
export async function series(ctx: Ctx, id: string) {
  try {
    const t = await ctx.tmdb.tv(id);
    const last = await ctx.progress.latest(t.id);
    const first = seasonNumbers(t)[0];
    // Complete: offer the start again, so Play still does something.
    const target = (await nextFor(ctx, t, last)) ?? (last && first ? { season: first, episode: 1 } : null);
    const saved = target && (await ctx.progress.get({ mediaType: "tv", tmdbId: t.id, ...target }));
    return Response.json({
      id: t.id,
      title: t.name ?? "",
      years: years(t),
      genres: (t.genres ?? []).map((g) => g.name),
      overview: t.overview ?? "",
      backdropPath: t.backdrop_path ?? null,
      seasons: realSeasons(t).map((s) => ({ season: s.season_number, name: s.name ?? `Season ${s.season_number}`, episodeCount: s.episode_count ?? 0 })),
      next: target && {
        ...target,
        progress: saved && !saved.finished ? { position: saved.position, duration: saved.duration } : null,
      },
    });
  } catch (status) {
    return tmdbError(status);
  }
}

/** GET /api/tv/:id/season/:n — aired episodes only, each with its saved progress. */
export async function season(ctx: Ctx, id: number, n: number) {
  try {
    const episodes = (await ctx.tmdb.season(id, n)).filter((e) => !!e.air_date && e.air_date <= ctx.today());
    const saved = new Map((await ctx.progress.seasonProgress(id, n)).map((p) => [p.episode, p]));
    return Response.json({
      season: n,
      episodes: episodes.map((e) => {
        const p = saved.get(e.episode_number);
        return {
          episode: e.episode_number,
          name: e.name ?? `Episode ${e.episode_number}`,
          runtime: e.runtime || null,
          overview: e.overview ?? "",
          stillPath: e.still_path ?? null,
          progress: p ? { position: p.position, duration: p.duration, finished: p.finished } : null,
        };
      }),
    });
  } catch (status) {
    return tmdbError(status);
  }
}
