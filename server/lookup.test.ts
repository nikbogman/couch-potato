import { expect, test } from "bun:test";
import { lookup } from "./lookup";
import { createTmdb } from "./tmdb/client";

test("matches each title by type and year; a failed search is null, not a throw", async () => {
  const fake = (async (u: string) => {
    const q = new URL(u).searchParams.get("query");
    if (q === "boom") return new Response("", { status: 500 });
    return Response.json({
      results: [
        { id: 1, media_type: "tv", name: q, first_air_date: "2001-01-01", poster_path: "/tv.jpg" },
        { id: 2, media_type: "movie", title: q, release_date: "2002-05-01", poster_path: "/m.jpg" },
      ],
    });
  }) as typeof fetch;
  const got = await lookup(createTmdb("K", fake), [
    { title: "a", year: 2001, type: "movie" },
    { title: "b", year: null, type: "tv" },
    { title: "boom", year: null, type: "movie" },
  ]);
  expect(got.map((r) => r?.id ?? null)).toEqual([2, 1, null]);
  expect(got[0]?.posterPath).toBe("/m.jpg");
});
