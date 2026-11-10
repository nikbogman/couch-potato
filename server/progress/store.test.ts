import { expect, test } from "bun:test";
import { memoryStore } from "./testDb";

const movie = (tmdbId: number) => ({ mediaType: "movie" as const, tmdbId });

function store() {
  let t = 1000;
  const s = memoryStore(() => ++t);
  return s;
}

test("save is an upsert per movie and get reads it back", async () => {
  const s = store();
  expect(await s.get(movie(1))).toBeNull();
  await s.save({ ...movie(1), position: 100, duration: 1000 });
  await s.save({ ...movie(1), position: 250, duration: 1000 });
  expect(await s.get(movie(1))).toMatchObject({ tmdbId: 1, season: null, episode: null, position: 250, duration: 1000, finished: false });
  expect(await s.continueWatching()).toHaveLength(1);
});

test("an item is finished at 90% and leaves continue watching", async () => {
  const s = store();
  await s.save({ ...movie(1), position: 899, duration: 1000 });
  await s.save({ ...movie(2), position: 900, duration: 1000 });
  expect((await s.get(movie(2)))?.finished).toBe(true);
  expect((await s.continueWatching()).map((p) => p.tmdbId)).toEqual([1]);
});

test("continue watching is newest first", async () => {
  const s = store();
  for (const id of [1, 2, 3]) (await s.save({ ...movie(id), position: 10, duration: 1000 }));
  await s.save({ ...movie(1), position: 20, duration: 1000 });
  expect((await s.continueWatching()).map((p) => p.tmdbId)).toEqual([1, 3, 2]);
});

test("continue watching hands back at most 40 candidates, newest first (the API trims to 20 after dropping finished series)", async () => {
  const s = store();
  for (let id = 1; id <= 45; id++) (await s.save({ ...movie(id), position: 10, duration: 1000 }));
  const ids = (await s.continueWatching()).map((p) => p.tmdbId);
  expect(ids).toHaveLength(40);
  expect(ids[0]).toBe(45);
  expect(ids).not.toContain(5);
});

test("hiding removes from continue watching but keeps progress; watching again brings it back", async () => {
  const s = store();
  await s.save({ ...movie(1), position: 10, duration: 1000 });
  expect(await s.hide(movie(1))).toBe(true);
  expect(await s.continueWatching()).toEqual([]);
  expect((await s.get(movie(1)))?.position).toBe(10);
  await s.save({ ...movie(1), position: 20, duration: 1000 });
  expect((await s.continueWatching()).map((p) => p.position)).toEqual([20]);
  expect(await s.hide(movie(99))).toBe(false);
});

test("position is clamped to the duration, and episodes are separate rows from the movie", async () => {
  const s = store();
  await s.save({ ...movie(1), position: 5000, duration: 1000 });
  expect((await s.get(movie(1)))?.position).toBe(1000);
  await s.save({ mediaType: "tv", tmdbId: 1, season: 1, episode: 2, position: 5, duration: 100 });
  await s.save({ mediaType: "tv", tmdbId: 1, season: 1, episode: 2, position: 6, duration: 100 });
  expect((await s.get({ mediaType: "tv", tmdbId: 1, season: 1, episode: 2 }))?.position).toBe(6);
  expect((await s.get(movie(1)))?.position).toBe(1000);
});

const ep = (tmdbId: number, season: number, episode: number) => ({ mediaType: "tv" as const, tmdbId, season, episode });

test("continue watching has one entry per series: its most recently watched episode, finished or not", async () => {
  const s = store();
  await s.save({ ...ep(5, 1, 1), position: 100, duration: 100 });
  await s.save({ ...ep(5, 1, 2), position: 10, duration: 100 });
  await s.save({ ...movie(1), position: 10, duration: 1000 });
  await s.save({ ...ep(6, 2, 4), position: 99, duration: 100 }); // finished, the caller works out what comes next
  expect((await s.continueWatching()).map((p) => [p.mediaType, p.tmdbId, p.season, p.episode])).toEqual([
    ["tv", 6, 2, 4],
    ["movie", 1, null, null],
    ["tv", 5, 1, 2],
  ]);
});

test("hiding a series hides every episode, and watching any episode again brings the series back", async () => {
  const s = store();
  await s.save({ ...ep(5, 1, 1), position: 10, duration: 100 });
  await s.save({ ...ep(5, 1, 2), position: 10, duration: 100 });
  expect(await s.hide({ mediaType: "tv", tmdbId: 5 })).toBe(true);
  expect(await s.continueWatching()).toEqual([]);
  expect((await s.get(ep(5, 1, 1)))?.position).toBe(10);
  await s.save({ ...ep(5, 1, 3), position: 5, duration: 100 });
  expect((await s.continueWatching()).map((p) => p.episode)).toEqual([3]);
  expect(await s.hide({ mediaType: "tv", tmdbId: 404 })).toBe(false);
});

test("latest and season progress read a series back", async () => {
  const s = store();
  expect(await s.latest(5)).toBeNull();
  await s.save({ ...ep(5, 1, 1), position: 100, duration: 100 });
  await s.save({ ...ep(5, 2, 1), position: 10, duration: 100 });
  await s.save({ ...ep(5, 1, 2), position: 20, duration: 100 });
  await s.save({ ...ep(9, 1, 1), position: 20, duration: 100 });
  expect(await s.latest(5)).toMatchObject({ season: 1, episode: 2 });
  expect((await s.seasonProgress(5, 1)).map((p) => [p.episode, p.finished])).toEqual([[1, true], [2, false]]);
  expect(await s.seasonProgress(5, 3)).toEqual([]);
});
