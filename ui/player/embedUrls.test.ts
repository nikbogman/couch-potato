import { expect, test } from "bun:test";
import { playeroneMovieUrl, playeroneTvUrl } from "./embedUrls";

test("playerone movie url, with and without a start time", () => {
  expect(playeroneMovieUrl(603)).toBe("https://player-one.test/movie/603?autoplay=1");
  expect(playeroneMovieUrl("603", 90.7)).toBe("https://player-one.test/movie/603?t=90&autoplay=1");
});

test("playerone episode url autoplays and auto-nexts, never turns on the in-player episode list", () => {
  expect(playeroneTvUrl(1396, 2, 4, 90.7)).toBe("https://player-one.test/tv/1396/2/4?t=90&autoplay=1&autonext=1");
  expect(playeroneTvUrl("1396", 1, 1)).toBe("https://player-one.test/tv/1396/1/1?autoplay=1&autonext=1");
  expect(playeroneTvUrl(1396, 1, 1)).not.toContain("episodes");
});

