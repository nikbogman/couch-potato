import { expect, test } from "bun:test";
import { handle, type Env } from "../handler";
import { memoryD1 } from "../progress/testDb";
import { createCollection, PAGE_SIZE, type Key, type Status } from "./store";

const TITLES: Record<string, { title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path: string | null }> = {
  "movie/3": { title: "Heat", release_date: "1995-12-15", poster_path: "/heat.jpg" },
  "movie/4": { title: "Alien", release_date: "1979-05-25", poster_path: null },
  "tv/3": { name: "Severance", first_air_date: "2022-02-18", poster_path: "/s.jpg" },
};
let tmdbDown = false;
const tmdb = (async (url: string) => {
  if (tmdbDown) return new Response("", { status: 500 });
  const m = new URL(url).pathname.match(/^\/3\/(movie|tv)\/(\d+)$/);
  const t = m && TITLES[`${m[1]}/${m[2]}`];
  return t ? Response.json({ id: Number(m![2]), ...t }) : new Response("", { status: 404 });
}) as unknown as typeof fetch;

async function app() {
  const env: Env = {
    COUCH_PASSWORD: "pw",
    TMDB_API_KEY: "KEY",
    DB: memoryD1(),
    ASSETS: { fetch: async () => new Response("shell") },
    RELAY: { getByName: () => ({ fetch: async () => new Response("relay") }) },
  };
  const login = await handle(
    new Request("https://x.test/login", { method: "POST", body: new URLSearchParams({ password: "pw", next: "/" }), headers: { "content-type": "application/x-www-form-urlencoded" } }),
    env,
    tmdb,
  );
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const call = (path: string, init: RequestInit = {}, auth = cookie) =>
    handle(new Request(`https://x.test${path}`, { ...init, headers: { cookie: auth, "content-type": "application/json", ...init.headers } }), env, tmdb);
  const put = (path: string, body: unknown) => call(path, { method: "PUT", body: JSON.stringify(body) });
  return {
    call,
    put,
    set: (k: string, change: Change) => put(`/api/collection/${k}/${"status" in change ? "status" : "favourite"}`, change),
    entry: async (k: string) => (await call(`/api/collection/${k}`)).json(),
    list: async (q: string) => (await call(`/api/collection?${q}`)).json(),
  };
}

type Change = { status: Status | null } | { favourite: boolean };
const TO_WATCH = { status: "to_watch" } as const;
const WATCHED = { status: "watched" } as const;
const DROP = { status: null };
const FAVOURITE = { favourite: true };
const UNFAVOURITE = { favourite: false };
const out = { status: null, favourite: false };
const toWatch = { status: "to_watch", favourite: false };
const watched = { status: "watched", favourite: false };
const favourite = { status: "watched", favourite: true };

// [changes that reach the starting entry, change, expected entry]: Popcorn's Status and Favourite rules.
const rules: [Change[], Change, object][] = [
  [[], TO_WATCH, toWatch],
  [[], WATCHED, watched],
  [[], DROP, out],
  [[], FAVOURITE, favourite],
  [[], UNFAVOURITE, out],
  [[TO_WATCH], TO_WATCH, toWatch],
  [[TO_WATCH], WATCHED, watched],
  [[TO_WATCH], DROP, out],
  [[TO_WATCH], FAVOURITE, favourite],
  [[TO_WATCH], UNFAVOURITE, toWatch],
  [[WATCHED], TO_WATCH, toWatch],
  [[WATCHED], WATCHED, watched],
  [[WATCHED], DROP, out],
  [[WATCHED], FAVOURITE, favourite],
  [[WATCHED], UNFAVOURITE, watched],
  [[FAVOURITE], TO_WATCH, toWatch],
  [[FAVOURITE], WATCHED, favourite],
  [[FAVOURITE], DROP, out],
  [[FAVOURITE], FAVOURITE, favourite],
  [[FAVOURITE], UNFAVOURITE, watched],
];

test.each(rules)("after %j, setting %j gives %j", async (setup, change, expected) => {
  const a = await app();
  for (const c of setup) await a.set("movie/3", c);
  const res = await a.set("movie/3", change);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject(expected);
  expect(await a.entry("movie/3")).toMatchObject(expected);
});

test("watchedAt is set exactly when Watched", async () => {
  const a = await app();
  await a.set("movie/3", TO_WATCH);
  expect((await a.entry("movie/3")).watchedAt).toBeNull();
  await a.set("movie/3", WATCHED);
  expect(typeof (await a.entry("movie/3")).watchedAt).toBe("number");
});

test("a movie and a series with the same TMDB id are separate entries, copied from TMDB once", async () => {
  const a = await app();
  await a.set("movie/3", TO_WATCH);
  await a.set("tv/3", WATCHED);
  expect((await a.list("list=to_watch")).items).toEqual([expect.objectContaining({ id: 3, mediaType: "movie", title: "Heat", year: "1995", posterPath: "/heat.jpg" })]);
  expect((await a.list("list=watched")).items).toEqual([expect.objectContaining({ id: 3, mediaType: "tv", title: "Severance", year: "2022" })]);
});

test("an unknown title is a 404 and isn't added; TMDB down is a 502", async () => {
  const a = await app();
  expect((await a.set("movie/999", TO_WATCH)).status).toBe(404);
  expect((await a.list("list=to_watch")).total).toBe(0);
  tmdbDown = true;
  try {
    expect((await a.set("movie/3", TO_WATCH)).status).toBe(502);
  } finally {
    tmdbDown = false;
  }
});

test("bad input is a 400 or 404, and the collection needs the session", async () => {
  const a = await app();
  expect((await a.call("/api/collection?list=nope")).status).toBe(400);
  expect((await a.call("/api/collection?list=watched&order=sideways")).status).toBe(400);
  expect((await a.call("/api/collection?list=watched&offset=-1")).status).toBe(400);
  expect((await a.put("/api/collection/movie/3/status", { status: "watching" })).status).toBe(400);
  expect((await a.put("/api/collection/movie/3/favourite", { favourite: "yes" })).status).toBe(400);
  expect((await a.put("/api/collection/person/3/status", TO_WATCH)).status).toBe(404);
  expect((await a.call("/api/collection/movie/0")).status).toBe(404);
  expect((await a.call("/api/collection?list=watched", {}, "")).status).toBe(401);
});

// Paging, sorting and search run on the store directly with a fake clock, so ordering is deterministic.
function store() {
  let t = 0;
  const c = createCollection(memoryD1(), async ({ tmdbId }) => ({ title: `Title ${tmdbId}${tmdbId % 2 ? " odd_%" : ""}`, year: null, posterPath: null }), () => ++t);
  return c;
}
const movie = (tmdbId: number): Key => ({ mediaType: "movie", tmdbId });

test("lists sort newest first by default, oldest first on request, and page without overlap", async () => {
  const c = store();
  const n = PAGE_SIZE + 5;
  for (let i = 1; i <= n; i++) await c.setStatus(movie(i), "to_watch");
  const first = await c.list("to_watch");
  expect(first.items[0]!.id).toBe(n);
  expect(first.items).toHaveLength(PAGE_SIZE);
  expect(first.nextOffset).toBe(PAGE_SIZE);
  const second = await c.list("to_watch", { offset: first.nextOffset! });
  expect(second.items.map((i) => i.id)).toEqual([5, 4, 3, 2, 1]);
  expect(second.nextOffset).toBeNull();
  expect((await c.list("to_watch", { oldestFirst: true })).items[0]!.id).toBe(1);
});

test("Watched sorts by when it was watched; Favourites holds only favourites", async () => {
  const c = store();
  await c.setStatus(movie(1), "to_watch"); // added first...
  await c.setStatus(movie(2), "watched");
  await c.setStatus(movie(1), "watched"); // ...but watched last
  await c.setFavourite(movie(2), true);
  expect((await c.list("watched")).items.map((i) => i.id)).toEqual([1, 2]);
  expect((await c.list("favourites")).items.map((i) => i.id)).toEqual([2]);
});

test("title search is a case-insensitive substring match with % and _ taken literally; total counts the whole list", async () => {
  const c = store();
  for (let i = 1; i <= 4; i++) await c.setStatus(movie(i), "watched");
  expect(await c.list("watched", { title: "ODD_%" })).toMatchObject({ total: 4, matching: 2 });
  expect((await c.list("watched", { title: "_" })).matching).toBe(2);
  expect((await c.list("watched", { title: "title 4" })).items.map((i) => i.id)).toEqual([4]);
});
