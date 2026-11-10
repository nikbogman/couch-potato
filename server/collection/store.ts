// Lists (To watch, Watched, Favourites), ported from Popcorn's collection onto D1. Rules: Popcorn's CONTEXT.md
// (a Watched title can be a Favourite; favouriting marks it Watched; unwatching drops it, it doesn't fall back to To watch).
import type { D1Like } from "../progress/store";

export type MediaType = "movie" | "tv";
export type Status = "to_watch" | "watched";
export const STATUSES: readonly Status[] = ["to_watch", "watched"];
export const LISTS = ["to_watch", "watched", "favourites"] as const;
export type List = (typeof LISTS)[number];
export const PAGE_SIZE = 30;

export type Key = { mediaType: MediaType; tmdbId: number };
/** What's copied in from TMDB once, when a title is first added. Never refreshed. */
export type TitleInfo = { title: string; year: string | null; posterPath: string | null };
/** A title's place in the lists. `status: null` means it isn't in them. */
export type EntryView = { status: Status | null; favourite: boolean; watchedAt: number | null };
/** A list row, shaped like Couch's SearchResult plus its dates. */
export type ListItem = { id: number; mediaType: MediaType } & TitleInfo & { addedAt: number; watchedAt: number | null; favourite: boolean };

type Entry = { status: Status; addedAt: number; watchedAt: number | null; favourite: boolean };
type Row = { media_type: MediaType; tmdb_id: number; title: string; year: string | null; poster_path: string | null; status: Status; added_at: number; watched_at: number | null; favourite: number };

const view = (e?: Entry | null): EntryView => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null });
const toEntry = (r: Row): Entry => ({ status: r.status, addedAt: r.added_at, watchedAt: r.watched_at, favourite: !!r.favourite });
const toItem = (r: Row): ListItem => ({
  id: r.tmdb_id,
  mediaType: r.media_type,
  title: r.title,
  year: r.year,
  posterPath: r.poster_path,
  addedAt: r.added_at,
  watchedAt: r.watched_at,
  favourite: !!r.favourite,
});

const toWatch = (now: number): Entry => ({ status: "to_watch", addedAt: now, watchedAt: null, favourite: false });
const watched = (current: Entry | undefined, now: number, favourite = false): Entry => ({ status: "watched", addedAt: current?.addedAt ?? now, watchedAt: now, favourite });

/** `lookup` fetches a title from TMDB the first time it's added (null: TMDB doesn't know it). `now` is injectable for tests. */
export function createCollection(db: D1Like, lookup: (k: Key) => Promise<TitleInfo | null>, now: () => number = Date.now) {
  const KEY = "media_type = ?1 and tmdb_id = ?2";

  async function find(k: Key) {
    const r = await db.prepare(`select * from collection where ${KEY}`).bind(k.mediaType, k.tmdbId).first<Row>();
    return r ? toEntry(r) : undefined;
  }

  async function drop(k: Key) {
    await db.prepare(`delete from collection where ${KEY}`).bind(k.mediaType, k.tmdbId).run();
    return view(null);
  }

  async function update(k: Key, e: Entry) {
    await db
      .prepare(`update collection set status = ?3, added_at = ?4, watched_at = ?5, favourite = ?6 where ${KEY}`)
      .bind(k.mediaType, k.tmdbId, e.status, e.addedAt, e.watchedAt, e.favourite ? 1 : 0)
      .run();
    return view(e);
  }

  /** Null if TMDB doesn't know the title. */
  async function create(k: Key, e: Entry) {
    const info = await lookup(k);
    if (!info) return null;
    await db
      .prepare(`insert into collection (media_type, tmdb_id, title, year, poster_path, status, added_at, watched_at, favourite)
        values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
      .bind(k.mediaType, k.tmdbId, info.title, info.year, info.posterPath, e.status, e.addedAt, e.watchedAt, e.favourite ? 1 : 0)
      .run();
    return view(e);
  }

  return {
    async entry(k: Key) {
      return view(await find(k));
    },

    /** Null drops the title. Resolves to null if the title is new and TMDB doesn't know it. */
    async setStatus(k: Key, status: Status | null) {
      if (status === null) return drop(k);
      const current = await find(k);
      if (current?.status === status) return view(current);
      const next = status === "to_watch" ? toWatch(now()) : watched(current, now());
      return current ? update(k, next) : create(k, next);
    },

    async setFavourite(k: Key, favourite: boolean) {
      const current = await find(k);
      if (current?.status === "watched") return update(k, { ...current, favourite });
      if (!favourite) return view(current); // not Watched, so no Favourite to clear
      const next = watched(current, now(), true);
      return current ? update(k, next) : create(k, next);
    },

    /**
     * Newest first unless oldestFirst. To watch sorts by when it was added, Watched and Favourites by when it was watched.
     * `total` counts the whole list, `matching` only titles containing `title`.
     */
    async list(list: List, { title = "", oldestFirst = false, offset = 0 }: { title?: string; oldestFirst?: boolean; offset?: number } = {}) {
      const where = list === "favourites" ? "favourite = 1" : `status = '${list}'`;
      const date = list === "to_watch" ? "added_at" : "watched_at";
      const dir = oldestFirst ? "asc" : "desc";
      const pattern = `%${title.replace(/[\\%_]/g, "\\$&")}%`;
      const search = `${where} and title like ?1 escape '\\'`;
      const [{ results }, total, matching] = await Promise.all([
        db
          .prepare(`select * from collection where ${search} order by ${date} ${dir}, media_type ${dir}, tmdb_id ${dir} limit ${PAGE_SIZE} offset ?2`)
          .bind(pattern, offset)
          .all<Row>(),
        db.prepare(`select count(*) as n from collection where ${where}`).bind().first<{ n: number }>(),
        db.prepare(`select count(*) as n from collection where ${search}`).bind(pattern).first<{ n: number }>(),
      ]);
      const next = offset + results.length;
      const m = matching?.n ?? 0;
      return { items: results.map(toItem), total: total?.n ?? 0, matching: m, nextOffset: next < m ? next : null };
    },
  };
}

export type Collection = ReturnType<typeof createCollection>;
