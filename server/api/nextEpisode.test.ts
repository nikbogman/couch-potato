import { expect, test } from "bun:test";
import { nextEpisode, type SeasonEpisodes } from "./nextEpisode";

const TODAY = "2026-11-08";
const season = (n: number, ...dates: (string | null)[]): SeasonEpisodes => ({
  season: n,
  episodes: dates.map((airDate, i) => ({ episode: i + 1, airDate })),
});
const seasons = [season(1, "2020-01-01", "2020-01-08", "2020-01-15"), season(2, "2021-01-01", "2021-01-08")];
const at = (s: number, e: number, finished: boolean) => ({ season: s, episode: e, finished });

test("an unfinished episode is its own next episode", () => {
  expect(nextEpisode(at(1, 2, false), seasons, TODAY)).toEqual({ season: 1, episode: 2 });
});

test("a finished episode moves on to the next one in the season", () => {
  expect(nextEpisode(at(1, 1, true), seasons, TODAY)).toEqual({ season: 1, episode: 2 });
});

test("a finished finale rolls into the first episode of the next season", () => {
  expect(nextEpisode(at(1, 3, true), seasons, TODAY)).toEqual({ season: 2, episode: 1 });
});

test("the last aired episode finished means the series is complete", () => {
  expect(nextEpisode(at(2, 2, true), seasons, TODAY)).toBeNull();
});

test("episodes that have not aired yet (or have no date) never count", () => {
  const s = [season(1, "2020-01-01", "2026-11-08", "2026-11-15", null), season(2, "2027-01-01")];
  expect(nextEpisode(at(1, 1, true), s, TODAY)).toEqual({ season: 1, episode: 2 }); // aired today counts
  expect(nextEpisode(at(1, 2, true), s, TODAY)).toBeNull(); // E3 is next week, S2 is next year
});

test("specials (season 0) are skipped, in both directions", () => {
  const s = [season(0, "2019-01-01"), ...seasons];
  expect(nextEpisode(null, s, TODAY)).toEqual({ season: 1, episode: 1 });
  expect(nextEpisode(at(1, 3, true), [season(0, "2019-01-01"), season(1, "2020-01-01"), season(3, "2022-01-01")], TODAY)).toEqual({
    season: 3,
    episode: 1,
  });
});

test("a season with nothing aired is stepped over to the next one that has", () => {
  const s = [season(1, "2020-01-01"), season(2, "2030-01-01"), season(3, "2022-01-01")];
  expect(nextEpisode(at(1, 1, true), s, TODAY)).toEqual({ season: 3, episode: 1 });
});

test("a series never watched starts at its first aired episode", () => {
  expect(nextEpisode(null, seasons, TODAY)).toEqual({ season: 1, episode: 1 });
  expect(nextEpisode(null, [season(1, "2030-01-01")], TODAY)).toBeNull();
});

test("gaps in episode numbers do not trip it up", () => {
  const s: SeasonEpisodes[] = [{ season: 1, episodes: [{ episode: 1, airDate: "2020-01-01" }, { episode: 3, airDate: "2020-01-08" }] }];
  expect(nextEpisode(at(1, 1, true), s, TODAY)).toEqual({ season: 1, episode: 3 });
});
