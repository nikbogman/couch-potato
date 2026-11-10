import { afterEach, expect, test } from "bun:test";
import { fetchNextEpisode } from "./api";

const real = globalThis.fetch;
afterEach(() => void (globalThis.fetch = real));

const mock = (seasons: Record<number, number[]>) => {
  globalThis.fetch = (async (url: string) => {
    const m = String(url).match(/\/season\/(\d+)$/);
    if (m) return Response.json({ episodes: (seasons[+m[1]!] ?? []).map((episode) => ({ episode })) });
    return Response.json({ seasons: Object.keys(seasons).map((s) => ({ season: +s })) });
  }) as never;
};
const at = (season: number, episode: number) => ({ mediaType: "tv" as const, id: 1, season, episode });

test("next episode is the following aired one in the season", async () => {
  mock({ 1: [1, 2, 3] });
  expect(await fetchNextEpisode(at(1, 1))).toEqual({ season: 1, episode: 2 });
});

test("after a finale it crosses into the next season that has aired episodes, skipping specials", async () => {
  mock({ 0: [1], 1: [1, 2], 2: [], 3: [4, 5] });
  expect(await fetchNextEpisode(at(1, 2))).toEqual({ season: 3, episode: 4 });
});

test("null at the end of the series", async () => {
  mock({ 1: [1, 2] });
  expect(await fetchNextEpisode(at(1, 2))).toBeNull();
});
