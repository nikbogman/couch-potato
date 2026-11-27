import { expect, test } from "bun:test";
import type { SearchResult } from "./api";
import { bestMatch } from "./find";

const r = (id: number, mediaType: "movie" | "tv", year: string | null): SearchResult => ({ id, mediaType, title: "x", year, posterPath: null });

test("picks the title of that type whose year fits", () => {
  const results = [r(1, "tv", "2001"), r(2, "movie", "1990"), r(3, "movie", "2002")];
  expect(bestMatch(results, "movie", "2001")?.id).toBe(3); // within a year: release dates vary by country
  expect(bestMatch(results, "tv", "2001")?.id).toBe(1);
  expect(bestMatch(results, null, "1990")?.id).toBe(2);
});

test("no year: the first of that type; nothing fitting: null, so the caller searches", () => {
  const results = [r(1, "tv", "2001"), r(2, "movie", "1990")];
  expect(bestMatch(results, "movie", null)?.id).toBe(2);
  expect(bestMatch(results, "movie", "2010")).toBeNull();
  expect(bestMatch([], null, null)).toBeNull();
});
