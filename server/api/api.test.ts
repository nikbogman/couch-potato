import { expect, test } from "bun:test";
import { createApi } from ".";
import { memoryStore } from "../progress/testDb";

type Fetch = (url: string) => Promise<Response>;

function api(fetch: Fetch) {
  return createApi({ apiKey: "KEY", fetch: fetch as typeof globalThis.fetch, progress: memoryStore() });
}
const get = (a: ReturnType<typeof api>, q?: string) =>
  a(new Request(`http://x/api/search${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`));

test("search keeps movies and tv in TMDB order, drops people, and maps fields", async () => {
  let called = "";
  const res = await get(
    api(async (url) => {
      called = url;
      return Response.json({
        results: [
          { media_type: "tv", id: 1, name: "Severance", first_air_date: "2022-02-18", poster_path: "/s.jpg" },
          { media_type: "person", id: 2, name: "Seven Someone" },
          { media_type: "movie", id: 3, title: "Se7en", release_date: "1995-09-22", poster_path: null },
          { media_type: "movie", id: 4, title: "Untitled", release_date: "" },
        ],
      });
    }),
    "sev",
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    results: [
      { id: 1, mediaType: "tv", title: "Severance", year: "2022", posterPath: "/s.jpg" },
      { id: 3, mediaType: "movie", title: "Se7en", year: "1995", posterPath: null },
      { id: 4, mediaType: "movie", title: "Untitled", year: null, posterPath: null },
    ],
  });
  const u = new URL(called);
  expect(u.pathname).toBe("/3/search/multi");
  expect(u.searchParams.get("query")).toBe("sev");
  expect(u.searchParams.get("language")).toBe("en-US");
  expect(u.searchParams.get("api_key")).toBe("KEY");
});

test("blank query returns no results without calling TMDB", async () => {
  const res = await get(api(() => Promise.reject(new Error("should not be called"))), "   ");
  expect(await res.json()).toEqual({ results: [] });
  const missing = await get(api(() => Promise.reject(new Error("should not be called"))));
  expect(await missing.json()).toEqual({ results: [] });
});

test("TMDB failure becomes a 502 that does not leak the key", async () => {
  for (const f of [
    async () => new Response("nope", { status: 401 }),
    async () => {
      throw new Error("boom https://api.themoviedb.org/3/x?api_key=KEY");
    },
  ]) {
    const res = await get(api(f), "sev");
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("KEY");
  }
});

test("unknown api paths are 404", async () => {
  const res = await api(async () => new Response("{}"))(new Request("http://x/api/nope"));
  expect(res.status).toBe(404);
});

test("trending maps items, defaults media type from the path, and calls the weekly endpoint", async () => {
  let called = "";
  const a = api(async (url) => {
    called = url;
    return Response.json({ results: [{ id: 9, name: "Show", first_air_date: "2024-01-01", poster_path: "/p.jpg" }] });
  });
  const res = await a(new Request("http://x/api/trending/tv"));
  expect(await res.json()).toEqual({
    results: [{ id: 9, mediaType: "tv", title: "Show", year: "2024", posterPath: "/p.jpg" }],
  });
  const u = new URL(called);
  expect(u.pathname).toBe("/3/trending/tv/week");
  expect(u.searchParams.get("language")).toBe("en-US");
});

test("trending failure is a 502 without the key, and other kinds are 404", async () => {
  const res = await api(async () => new Response("no", { status: 500 }))(new Request("http://x/api/trending/movie"));
  expect(res.status).toBe(502);
  expect(await res.text()).not.toContain("KEY");
  const bad = await api(async () => new Response("{}"))(new Request("http://x/api/trending/person"));
  expect(bad.status).toBe(404);
});

test("movie details are mapped, and TMDB 404 / failure map to 404 / 502", async () => {
  let called = "";
  const a = api(async (url) => {
    called = url;
    if (url.includes("/movie/404")) return new Response("{}", { status: 404 });
    if (url.includes("/movie/500")) return new Response("{}", { status: 500 });
    return Response.json({
      id: 603, title: "The Matrix", release_date: "1999-03-30", runtime: 136,
      genres: [{ id: 1, name: "Action" }, { id: 2, name: "Sci-Fi" }],
      overview: "A hacker.", backdrop_path: "/b.jpg", cast: ["ignored"],
    });
  });
  const res = await a(new Request("http://x/api/movie/603"));
  expect(await res.json()).toEqual({
    id: 603, title: "The Matrix", year: "1999", runtime: 136,
    genres: ["Action", "Sci-Fi"], overview: "A hacker.", backdropPath: "/b.jpg",
  });
  expect(new URL(called).pathname).toBe("/3/movie/603");
  expect((await a(new Request("http://x/api/movie/404"))).status).toBe(404);
  const bad = await a(new Request("http://x/api/movie/500"));
  expect(bad.status).toBe(502);
  expect(JSON.stringify(await bad.json())).not.toContain("KEY");
});

const post = (a: ReturnType<typeof api>, path: string, body: unknown, method = "POST") =>
  a(new Request(`http://x${path}`, { method, body: typeof body === "string" ? body : JSON.stringify(body) }));
const tmdbMovie = async (url: string) => {
  const id = new URL(url).pathname.split("/").pop();
  if (id === "500") return new Response("no", { status: 500 });
  return Response.json({ id: Number(id), title: `Movie ${id}`, release_date: "2001-01-01", poster_path: "/p.jpg", backdrop_path: "/b.jpg" });
};

test("progress: save, read back with the finished flag, and validate input", async () => {
  const a = api(tmdbMovie);
  expect((await post(a, "/api/progress", { mediaType: "movie", tmdbId: 7, position: 60, duration: 100 })).status).toBe(204);
  const res = await a(new Request("http://x/api/progress?mediaType=movie&id=7"));
  expect(await res.json()).toEqual({ progress: { position: 60, duration: 100, finished: false } });
  await post(a, "/api/progress", { mediaType: "movie", tmdbId: 7, position: 95, duration: 100 });
  expect(((await (await a(new Request("http://x/api/progress?mediaType=movie&id=7"))).json()) as any).progress.finished).toBe(true);
  expect(await (await a(new Request("http://x/api/progress?mediaType=movie&id=8"))).json()).toEqual({ progress: null });
  for (const bad of [
    { mediaType: "movie", tmdbId: 7, position: -1, duration: 100 },
    { mediaType: "movie", tmdbId: 7, position: 1, duration: 0 },
    { mediaType: "song", tmdbId: 7, position: 1, duration: 10 },
    { mediaType: "movie", tmdbId: "x", position: 1, duration: 10 },
    "not json",
  ]) {
    expect((await post(a, "/api/progress", bad)).status).toBe(400);
  }
});

test("progress accepts a beacon-style body with a text/plain content type", async () => {
  const a = api(tmdbMovie);
  const res = await a(
    new Request("http://x/api/progress", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ mediaType: "movie", tmdbId: 1, position: 5, duration: 50 }),
    }),
  );
  expect(res.status).toBe(204);
});

test("continue watching lists unfinished movies with TMDB details, newest first, and remove hides one", async () => {
  const a = api(tmdbMovie);
  for (const [tmdbId, position] of [[1, 10], [2, 20], [3, 99]] as const)
    await post(a, "/api/progress", { mediaType: "movie", tmdbId, position, duration: 100 });
  const body = (await (await a(new Request("http://x/api/continue"))).json()) as { results: any[] };
  expect(body.results.map((r) => r.id)).toEqual([2, 1]);
  expect(body.results[0]).toEqual({
    id: 2, mediaType: "movie", title: "Movie 2", year: "2001", posterPath: "/p.jpg", backdropPath: "/b.jpg", position: 20, duration: 100,
  });
  expect((await a(new Request("http://x/api/continue/movie/2", { method: "DELETE" }))).status).toBe(204);
  expect((await a(new Request("http://x/api/continue/movie/404", { method: "DELETE" }))).status).toBe(404);
  const after = (await (await a(new Request("http://x/api/continue"))).json()) as { results: any[] };
  expect(after.results.map((r) => r.id)).toEqual([1]);
});

test("continue watching skips an item whose TMDB lookup fails", async () => {
  const a = api(tmdbMovie);
  await post(a, "/api/progress", { mediaType: "movie", tmdbId: 500, position: 10, duration: 100 });
  await post(a, "/api/progress", { mediaType: "movie", tmdbId: 1, position: 10, duration: 100 });
  const body = (await (await a(new Request("http://x/api/continue"))).json()) as { results: any[] };
  expect(body.results.map((r) => r.id)).toEqual([1]);
});
