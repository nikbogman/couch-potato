import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createCollection } from "../collection/store";
import { createProgressStore, type D1Like } from "../progress/store";
import { hashPassword } from "./crypto";

const migration = (f: string) => readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8");
const d1 = (db: Database): D1Like => ({
  prepare: (sql) => ({
    bind: (...v) => ({
      first: async <T>() => db.query(sql).get(...(v as never[])) as T | null,
      all: async <T>() => ({ results: db.query(sql).all(...(v as never[])) as T[] }),
      run: async () => ({ meta: { changes: db.query(sql).run(...(v as never[])).changes } }),
    }),
  }),
});

test("the single-user lists and progress from before accounts become the owner's (user 1)", async () => {
  const db = new Database(":memory:");
  db.run(migration("0001_progress.sql"));
  db.run(migration("0002_collection.sql"));
  db.run("insert into collection (media_type, tmdb_id, title, status, added_at, watched_at, favourite) values ('movie', 550, 'Fight Club', 'watched', 1, 2, 1)");
  db.run("insert into progress (media_type, tmdb_id, season, episode, position, duration, updated_at) values ('tv', 95396, 2, 4, 1308, 3180, 3)");

  db.run(migration("0003_accounts.sql"));
  // what scripts/owner.ts runs
  db.query("insert into users (id, name, password_hash, owner, created_at) values (1, 'Nik', ?1, 1, 4) on conflict (id) do update set name = excluded.name, password_hash = excluded.password_hash, owner = 1, phone_session = null")
    .run(await hashPassword("test pass 123"));

  const lists = createCollection(d1(db), 1, async () => null);
  expect(await lists.list("favourites")).toMatchObject({ total: 1, items: [{ id: 550, title: "Fight Club", favourite: true }] });
  const progress = createProgressStore(d1(db), 1);
  expect(await progress.latest(95396)).toMatchObject({ season: 2, episode: 4, position: 1308 });
  expect((await createCollection(d1(db), 2, async () => null).list("favourites")).total).toBe(0); // nobody else sees it
});
