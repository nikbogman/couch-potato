import { expect, test } from "bun:test";
import { HOSTS, tagOf } from "./hosts";
import { p1MovieUrl, p1TvUrl } from "./embedUrls";

test("player 1 movie url, with and without a start time", () => {
  expect(p1MovieUrl(603)).toBe(`${HOSTS.p1}/movie/603?autoplay=1`);
  expect(p1MovieUrl("603", 90.7)).toBe(`${HOSTS.p1}/movie/603?t=90&autoplay=1`);
});

test("player 1 episode url autoplays and auto-nexts, never turns on the in-player episode list", () => {
  expect(p1TvUrl(1396, 2, 4, 90.7)).toBe(`${HOSTS.p1}/tv/1396/2/4?t=90&autoplay=1&autonext=1`);
  expect(p1TvUrl("1396", 1, 1)).toBe(`${HOSTS.p1}/tv/1396/1/1?autoplay=1&autonext=1`);
  expect(p1TvUrl(1396, 1, 1)).not.toContain("episodes");
});

