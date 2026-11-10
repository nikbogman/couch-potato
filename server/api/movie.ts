import { tmdbError, type Ctx } from "./http";

/** GET /api/movie/:id */
export async function movie(ctx: Ctx, id: string) {
  try {
    const m = await ctx.tmdb.movie(id);
    return Response.json({
      id: m.id,
      title: m.title ?? "",
      year: m.release_date?.slice(0, 4) || null,
      runtime: m.runtime || null,
      genres: (m.genres ?? []).map((g) => g.name),
      overview: m.overview ?? "",
      backdropPath: m.backdrop_path ?? null,
    });
  } catch (status) {
    return tmdbError(status);
  }
}
