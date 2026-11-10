// /api/collection: Popcorn's collection routes, keyed by media type + TMDB id so series fit too.
import { Hono } from "hono";
import type { Tmdb } from "../tmdb/client";
import { createCollection, LISTS, STATUSES, type Key, type List, type Status, type TitleInfo } from "./store";
import type { D1Like } from "../progress/store";

const fail = (error: string, status: 400 | 404 | 502) => Response.json({ error }, { status });

/** Any TMDB failure but a 404. */
class TmdbFailed extends Error {}

/** TMDB's view of a title, or null on 404. Other failures throw TmdbFailed. */
export function tmdbLookup(tmdb: Tmdb) {
  return async ({ mediaType, tmdbId }: Key): Promise<TitleInfo | null> => {
    try {
      if (mediaType === "movie") {
        const m = await tmdb.movie(tmdbId);
        return { title: m.title ?? "", year: m.release_date?.slice(0, 4) || null, posterPath: m.poster_path ?? null };
      }
      const t = await tmdb.tv(tmdbId);
      return { title: t.name ?? "", year: t.first_air_date?.slice(0, 4) || null, posterPath: t.poster_path ?? null };
    } catch (status) {
      if (status === 404) return null;
      throw new TmdbFailed();
    }
  };
}

function key(mediaType: string, id: string): Key | null {
  const tmdbId = Number(id);
  return (mediaType === "movie" || mediaType === "tv") && Number.isInteger(tmdbId) && tmdbId > 0 ? { mediaType, tmdbId } : null;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Mounted at /api/collection; call `.fetch` with the full request. */
export function collectionRoutes(db: D1Like, tmdb: Tmdb, now?: () => number) {
  const collection = createCollection(db, tmdbLookup(tmdb), now);
  const notFound = () => fail("Not found", 404);

  return new Hono()
    .basePath("/api/collection")
    .onError((err) => (err instanceof TmdbFailed ? fail("TMDB request failed", 502) : Response.json({ error: "Internal error" }, { status: 500 })))
    .get("/", async (c) => {
      const { list, title = "", order = "newest", offset = "0" } = c.req.query();
      const start = Number(offset);
      if (!LISTS.includes(list as List) || (order !== "newest" && order !== "oldest") || !Number.isInteger(start) || start < 0) {
        return fail(`list is one of ${LISTS.join(", ")}, order is newest or oldest, offset is a whole number from 0`, 400);
      }
      return c.json(await collection.list(list as List, { title: title.trim(), oldestFirst: order === "oldest", offset: start }));
    })
    .get("/:mediaType/:id", async (c) => {
      const k = key(c.req.param("mediaType"), c.req.param("id"));
      return k ? c.json(await collection.entry(k)) : notFound();
    })
    .put("/:mediaType/:id/status", async (c) => {
      const k = key(c.req.param("mediaType"), c.req.param("id"));
      if (!k) return notFound();
      const { status } = await body(c.req.raw);
      if (status !== null && !STATUSES.includes(status as Status)) return fail(`status must be null or one of ${STATUSES.join(", ")}`, 400);
      const entry = await collection.setStatus(k, status as Status | null);
      return entry ? c.json(entry) : notFound();
    })
    .put("/:mediaType/:id/favourite", async (c) => {
      const k = key(c.req.param("mediaType"), c.req.param("id"));
      if (!k) return notFound();
      const { favourite } = await body(c.req.raw);
      if (typeof favourite !== "boolean") return fail("favourite must be true or false", 400);
      const entry = await collection.setFavourite(k, favourite);
      return entry ? c.json(entry) : notFound();
    });
}
