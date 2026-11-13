type ProgressKey = { mediaType: "movie" | "tv"; tmdbId: number; season?: number | null; episode?: number | null };
export type Progress = Required<ProgressKey> & { position: number; duration: number; updatedAt: number; finished: boolean };

/** The slice of Cloudflare D1 the store uses (D1Database satisfies it), so tests can run it on bun:sqlite. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta: { changes: number } }>;
    };
  };
}

/** An item counts as watched at this fraction. */
const FINISHED_AT = 0.9;
export const CONTINUE_LIMIT = 20;
/** Candidates handed to the caller, who drops finished series and then applies CONTINUE_LIMIT. */
// ponytail: a pile of completed series could crowd real ones out of the first 40; page it if that ever happens.
const CANDIDATE_LIMIT = CONTINUE_LIMIT * 2;

type Row = {
  media_type: "movie" | "tv";
  tmdb_id: number;
  season: number | null;
  episode: number | null;
  position: number;
  duration: number;
  updated_at: number;
};

const toProgress = (r: Row): Progress => ({
  mediaType: r.media_type,
  tmdbId: r.tmdb_id,
  season: r.season,
  episode: r.episode,
  position: r.position,
  duration: r.duration,
  updatedAt: r.updated_at,
  finished: r.position >= r.duration * FINISHED_AT,
});

/** `userId`'s watch progress on D1, one row per movie or episode (schema: migrations/). `now` is injectable for tests. */
export function createProgressStore(db: D1Like, userId: number, now: () => number = Date.now) {
  // ?1 user, ?2 media type, ?3 tmdb id, ?4 season, ?5 episode; null season/episode compare as -1 to match the unique index.
  const where = "user_id = ?1 and media_type = ?2 and tmdb_id = ?3 and ifnull(season, -1) = ifnull(?4, -1) and ifnull(episode, -1) = ifnull(?5, -1)";
  const key = (k: ProgressKey) => [userId, k.mediaType, k.tmdbId, k.season ?? null, k.episode ?? null];

  return {
    /** Insert or update. Watching again un-hides the item. Callers validate: duration > 0, position >= 0. */
    async save(k: ProgressKey & { position: number; duration: number }) {
      await db
        .prepare(`insert into progress (user_id, media_type, tmdb_id, season, episode, position, duration, updated_at)
          values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          on conflict (user_id, media_type, tmdb_id, ifnull(season, -1), ifnull(episode, -1))
          do update set position = ?6, duration = ?7, updated_at = ?8, hidden = 0`)
        .bind(...key(k), Math.min(k.position, k.duration), k.duration, now())
        .run();
    },
    async get(k: ProgressKey): Promise<Progress | null> {
      const r = await db.prepare(`select * from progress where ${where}`).bind(...key(k)).first<Row>();
      return r && toProgress(r);
    },
    /**
     * Newest first: unfinished movies and each series' latest episode (finished or not: the caller works out what comes next).
     * A series is hidden when its latest row is; hide() flags every row and a new save clears only its own.
     * Not capped to 20 yet, see CANDIDATE_LIMIT.
     */
    async continueWatching(): Promise<Progress[]> {
      const { results } = await db
        .prepare(`select * from progress p
          where user_id = ?1 and hidden = 0 and (
            (media_type = 'movie' and position < duration * ${FINISHED_AT})
            or (media_type = 'tv' and rowid = (select rowid from progress q where q.user_id = ?1 and q.media_type = 'tv' and q.tmdb_id = p.tmdb_id
              order by updated_at desc, rowid desc limit 1)))
          order by updated_at desc, rowid desc limit ${CANDIDATE_LIMIT}`)
        .bind(userId)
        .all<Row>();
      return results.map(toProgress);
    },
    /** The most recently watched episode of a series. */
    async latest(tmdbId: number): Promise<Progress | null> {
      const r = await db
        .prepare(`select * from progress where user_id = ?1 and media_type = 'tv' and tmdb_id = ?2 order by updated_at desc, rowid desc limit 1`)
        .bind(userId, tmdbId)
        .first<Row>();
      return r && toProgress(r);
    },
    async seasonProgress(tmdbId: number, season: number): Promise<Progress[]> {
      const { results } = await db
        .prepare(`select * from progress where user_id = ?1 and media_type = 'tv' and tmdb_id = ?2 and season = ?3 order by episode`)
        .bind(userId, tmdbId, season)
        .all<Row>();
      return results.map(toProgress);
    },
    /** Hide from Continue watching, keeping the progress. A series is hidden as a whole. False if there is nothing to hide. */
    async hide(k: ProgressKey): Promise<boolean> {
      const r =
        k.mediaType === "tv"
          ? await db.prepare(`update progress set hidden = 1 where user_id = ?1 and media_type = 'tv' and tmdb_id = ?2`).bind(userId, k.tmdbId).run()
          : await db.prepare(`update progress set hidden = 1 where ${where}`).bind(...key(k)).run();
      return r.meta.changes > 0;
    },
  };
}

export type ProgressStore = ReturnType<typeof createProgressStore>;
