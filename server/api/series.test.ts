import { expect, test } from "bun:test";
import { createApi } from ".";
import { memoryStore } from "../progress/testDb";

const ep = (n: number, airDate: string | null) => ({
  episode_number: n, name: `Ep ${n}`, runtime: 40 + n, overview: `About ${n}`, still_path: `/s${n}.jpg`, air_date: airDate,
});
const show = (over: Record<string, unknown> = {}) => ({
  id: 10, name: "Show", first_air_date: "2020-01-05", last_air_date: "2022-03-01", status: "Ended",
  genres: [{ id: 1, name: "Drama" }], overview: "A show.", poster_path: "/p.jpg", backdrop_path: "/b.jpg",
  seasons: [
    { season_number: 0, name: "Specials", episode_count: 1 },
    { season_number: 1, name: "Season 1", episode_count: 3 },
    { season_number: 2, name: "Season 2", episode_count: 2 },
    { season_number: 3, name: "Season 3", episode_count: 0 }, // announced, nothing yet
  ],
  ...over,
});
const SEASONS: Record<string, unknown[]> = {
  "10/1": [ep(1, "2020-01-05"), ep(2, "2020-01-12"), ep(3, "2020-01-19")],
  "10/2": [ep(1, "2021-01-05"), ep(2, "2099-01-01")], // E2 has not aired
};
let tmdbCalls: string[] = [];
const tmdb = async (url: string) => {
  const path = new URL(url).pathname.replace("/3", "");
  tmdbCalls.push(path);
  const m = path.match(/^\/tv\/(\d+)(?:\/season\/(\d+))?$/);
  if (m && m[1] === "10" && !m[2]) return Response.json(show());
  if (m && m[1] === "11" && !m[2]) return Response.json(show({ id: 11, name: "Running", status: "Returning Series", first_air_date: "2022-02-02" }));
  if (m && m[1] === "12" && !m[2]) return Response.json(show({ id: 12, name: "Short", first_air_date: "2022-02-02", last_air_date: "2022-12-02" }));
  if (m?.[2] && SEASONS[`${m[1]}/${m[2]}`]) return Response.json({ episodes: SEASONS[`${m[1]}/${m[2]}`] });
  if (m?.[2] && m[1] !== "10") return Response.json({ episodes: SEASONS["10/1"] }); // other shows reuse season 1
  if (path.startsWith("/movie/")) {
    const id = path.split("/").pop();
    return Response.json({ id: Number(id), title: `Movie ${id}`, release_date: "2001-01-01", poster_path: "/p.jpg", backdrop_path: "/b.jpg" });
  }
  return new Response("{}", { status: path.includes("/tv/999") ? 404 : 500 });
};
const makeApi = () => createApi({ apiKey: "KEY", fetch: tmdb as typeof globalThis.fetch, progress: memoryStore(), today: () => "2026-11-08" });
type Api = ReturnType<typeof makeApi>;

const json = async (a: Api, path: string) => (await a(new Request(`http://x${path}`))).json() as Promise<any>;
const post = (a: Api, body: unknown) => a(new Request("http://x/api/progress", { method: "POST", body: JSON.stringify(body) }));
const saveEp = (a: Api, id: number, season: number, episode: number, position: number, duration = 100) =>
  post(a, { mediaType: "tv", tmdbId: id, season, episode, position, duration });
const saveMovie = (a: Api, id: number) => post(a, { mediaType: "movie", tmdbId: id, position: 10, duration: 100 });

test("series details: years, seasons without specials or empty ones, genres, and a first-time next episode", async () => {
  const a = makeApi();
  expect(await json(a, "/api/tv/10")).toEqual({
    id: 10, title: "Show", years: "2020–2022", genres: ["Drama"], rating: null, network: null, overview: "A show.", backdropPath: "/b.jpg",
    seasons: [{ season: 1, name: "Season 1", episodeCount: 3 }, { season: 2, name: "Season 2", episodeCount: 2 }],
    next: { season: 1, episode: 1, progress: null },
  });
  expect((await json(a, "/api/tv/11")).years).toBe("2022–");
  expect((await json(a, "/api/tv/12")).years).toBe("2022");
  expect((await a(new Request("http://x/api/tv/999"))).status).toBe(404);
  const bad = await a(new Request("http://x/api/tv/500"));
  expect(bad.status).toBe(502);
  expect(JSON.stringify(await bad.json())).not.toContain("KEY");
});

test("series next episode follows progress: resume, roll on, cross seasons, up to date", async () => {
  const a = makeApi();
  const next = async () => (await json(a, "/api/tv/10")).next;
  await saveEp(a, 10, 1, 2, 30);
  expect(await next()).toEqual({ season: 1, episode: 2, progress: { position: 30, duration: 100 } });
  await saveEp(a, 10, 1, 2, 95);
  expect(await next()).toEqual({ season: 1, episode: 3, progress: null });
  await saveEp(a, 10, 1, 3, 95);
  expect(await next()).toEqual({ season: 2, episode: 1, progress: null });
  await saveEp(a, 10, 2, 1, 95); // S2 E2 has not aired: nothing left, so the page falls back to the start
  expect(await next()).toEqual({ season: 1, episode: 1, progress: null });
});

test("season episodes: only aired ones, with their progress", async () => {
  const a = makeApi();
  await saveEp(a, 10, 2, 1, 50);
  await saveEp(a, 10, 1, 1, 95);
  expect(await json(a, "/api/tv/10/season/2")).toEqual({
    season: 2,
    episodes: [
      { episode: 1, name: "Ep 1", runtime: 41, overview: "About 1", stillPath: "/s1.jpg", progress: { position: 50, duration: 100, finished: false } },
    ],
  });
  const s1 = await json(a, "/api/tv/10/season/1");
  expect(s1.episodes.map((e: any) => [e.episode, e.progress?.finished ?? null])).toEqual([[1, true], [2, null], [3, null]]);
  expect((await a(new Request("http://x/api/tv/10/season/9"))).status).toBe(502);
});

test("episode progress is saved and read per episode, and tv needs a season and episode", async () => {
  const a = makeApi();
  expect((await saveEp(a, 10, 1, 2, 30)).status).toBe(204);
  expect(await json(a, "/api/progress?mediaType=tv&id=10&season=1&episode=2")).toEqual({ progress: { position: 30, duration: 100, finished: false } });
  expect(await json(a, "/api/progress?mediaType=tv&id=10&season=1&episode=3")).toEqual({ progress: null });
  for (const bad of [{ season: 1 }, { episode: 1 }, { season: "1", episode: 1 }, { season: 1, episode: 0 }, { season: -1, episode: 1 }, { season: 1.5, episode: 1 }])
    expect((await post(a, { mediaType: "tv", tmdbId: 10, position: 1, duration: 10, ...bad })).status).toBe(400);
  expect((await a(new Request("http://x/api/progress?mediaType=tv&id=10"))).status).toBe(400);
});

test("continue watching mixes movies and one card per series, newest first", async () => {
  const a = makeApi();
  await saveMovie(a, 1);
  await saveEp(a, 10, 1, 1, 100);
  await saveEp(a, 10, 1, 2, 60); // unfinished: this episode, with its time left
  await saveMovie(a, 2);
  await saveEp(a, 11, 1, 2, 100); // finished: points at the next episode, not started
  const { results } = await json(a, "/api/continue");
  expect(results.map((r: any) => [r.mediaType, r.id, r.season ?? null, r.episode ?? null, r.position, r.duration])).toEqual([
    ["tv", 11, 1, 3, 0, 0],
    ["movie", 2, null, null, 10, 100],
    ["tv", 10, 1, 2, 60, 100],
    ["movie", 1, null, null, 10, 100],
  ]);
  expect(results[0]).toMatchObject({ title: "Running", year: "2022", posterPath: "/p.jpg", backdropPath: "/b.jpg" });
});

test("a series whose last aired episode is finished leaves continue watching; unfinished ones need no season lookups", async () => {
  const a = makeApi();
  await saveEp(a, 10, 2, 1, 100);
  await saveEp(a, 11, 1, 2, 10);
  tmdbCalls = [];
  const { results } = await json(a, "/api/continue");
  expect(results.map((r: any) => r.id)).toEqual([11]);
  expect(tmdbCalls.filter((p) => p.includes("/season/"))).toEqual(["/tv/10/season/2"]); // no later season to look at
});

test("continue watching is capped at 20 after dropping completed series", async () => {
  const a = makeApi();
  for (let id = 100; id < 125; id++) await saveMovie(a, id);
  await saveEp(a, 10, 2, 1, 100); // complete, and newest
  const { results } = await json(a, "/api/continue");
  expect(results).toHaveLength(20);
  expect(results[0].id).toBe(124);
});

test("removing a series hides its card; watching again brings it back", async () => {
  const a = makeApi();
  await saveEp(a, 10, 1, 1, 10);
  expect((await a(new Request("http://x/api/continue/tv/10", { method: "DELETE" }))).status).toBe(204);
  expect((await a(new Request("http://x/api/continue/tv/77", { method: "DELETE" }))).status).toBe(404);
  expect((await json(a, "/api/continue")).results).toEqual([]);
  await saveEp(a, 10, 1, 2, 10);
  expect((await json(a, "/api/continue")).results.map((r: any) => r.episode)).toEqual([2]);
});
