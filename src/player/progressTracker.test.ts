import { expect, test } from "bun:test";
import type { PlayerEvent } from "./playerEvent";
import type { Target } from "../../shared/types";
import { createPlaybackTracker, createTracker } from "./progressTracker";

const ev = (kind: PlayerEvent["kind"], currentTime: number, duration = 1000): PlayerEvent => ({ kind, currentTime, duration });

function setup() {
  let t = 0;
  const saved: { position: number; duration: number }[] = [];
  const tracker = createTracker(
    (p) => saved.push(p),
    () => t,
  );
  return { tracker, saved, at: (ms: number) => (t = ms) };
}

test("saves about every 10 s while playing, not more often", () => {
  const { tracker, saved, at } = setup();
  tracker.onEvent(ev("play", 0));
  for (let s = 1; s <= 25; s++) {
    at(s * 1000);
    tracker.onEvent(ev("timeupdate", s));
  }
  expect(saved.map((p) => p.position)).toEqual([10, 20]);
});

test("saves immediately on pause and ended", () => {
  const { tracker, saved, at } = setup();
  at(1000);
  tracker.onEvent(ev("timeupdate", 3));
  at(2000);
  tracker.onEvent(ev("pause", 4));
  at(3000);
  tracker.onEvent(ev("ended", 1000));
  expect(saved.map((p) => p.position)).toEqual([4, 1000]);
});

test("flush saves the latest position once, and nothing if there is nothing new", () => {
  const { tracker, saved, at } = setup();
  tracker.flush();
  expect(saved).toEqual([]);
  at(1000);
  tracker.onEvent(ev("timeupdate", 7));
  tracker.flush();
  tracker.flush();
  expect(saved).toEqual([{ position: 7, duration: 1000 }]);
});

test("never saves without a known duration", () => {
  const { tracker, saved } = setup();
  tracker.onEvent(ev("pause", 5, 0));
  tracker.flush();
  expect(saved).toEqual([]);
});

test("stalled: no event for 30 s while playing, or nothing at all 30 s after load", () => {
  const { tracker, at } = setup();
  at(29_000);
  expect(tracker.stalled()).toBe(false);
  at(31_000);
  expect(tracker.stalled()).toBe(true); // nothing ever arrived
  tracker.onEvent(ev("ready", 0));
  expect(tracker.stalled()).toBe(false);
  at(80_000); // ready but never played (e.g. autoplay blocked): not stalled
  expect(tracker.stalled()).toBe(false);
  tracker.onEvent(ev("play", 0));
  at(100_000);
  expect(tracker.stalled()).toBe(false);
  at(131_000);
  expect(tracker.stalled()).toBe(true);
  tracker.onEvent(ev("timeupdate", 1));
  expect(tracker.stalled()).toBe(false);
});

test("a paused player is not stalled, however long it sits", () => {
  const { tracker, at } = setup();
  tracker.onEvent(ev("play", 0));
  at(1000);
  tracker.onEvent(ev("pause", 1));
  at(600_000);
  expect(tracker.stalled()).toBe(false);
});

test("status events set the playing state", () => {
  const { tracker, at } = setup();
  tracker.onEvent({ kind: "status", currentTime: 5, duration: 1000, paused: false });
  at(40_000);
  expect(tracker.stalled()).toBe(true);
});

test("a time of 0 (not known yet) never overwrites a position", () => {
  const { tracker, saved, at } = setup();
  at(1000);
  tracker.onEvent(ev("play", 0));
  tracker.flush();
  expect(saved).toEqual([]);
  at(2000);
  tracker.onEvent(ev("timeupdate", 8));
  tracker.onEvent(ev("pause", 0));
  expect(saved).toEqual([{ position: 8, duration: 1000 }]);
});

test("an episode switch saves the old episode where it ended and tracks the new one separately", () => {
  let t = 0;
  const saved: [string, number, number][] = [];
  const label = (x: Target) => (x.mediaType === "tv" ? `${x.season}x${x.episode}` : "movie");
  const tracker = createPlaybackTracker({ mediaType: "tv", id: 5, season: 1, episode: 1 }, (target, p) => saved.push([label(target), p.position, p.duration]), () => t);
  tracker.onEvent(ev("timeupdate", 2400, 2500));
  t = 5000;
  // the player moves on; its first message for the new episode still carries the old duration
  tracker.onEvent({ kind: "episodechange", currentTime: 0, duration: 2500, season: 1, episode: 2 });
  expect(saved).toEqual([["1x1", 2400, 2500]]);
  expect(tracker.target).toEqual({ mediaType: "tv", id: 5, season: 1, episode: 2 });
  t = 6000;
  tracker.onEvent(ev("timeupdate", 3, 1800));
  tracker.flush();
  expect(saved).toEqual([["1x1", 2400, 2500], ["1x2", 3, 1800]]);
});

test("an episodechange for the episode already playing, or on a movie, changes nothing", () => {
  const saved: unknown[] = [];
  const tv = createPlaybackTracker({ mediaType: "tv", id: 5, season: 1, episode: 1 }, (_, p) => saved.push(p));
  tv.onEvent(ev("timeupdate", 10));
  tv.onEvent({ kind: "episodechange", currentTime: 0, duration: 1000, season: 1, episode: 1 });
  expect(tv.target).toMatchObject({ season: 1, episode: 1 });
  const movie = createPlaybackTracker({ mediaType: "movie", id: 5 }, (_, p) => saved.push(p));
  movie.onEvent({ kind: "episodechange", currentTime: 0, duration: 1000, season: 1, episode: 2 });
  expect(movie.target).toEqual({ mediaType: "movie", id: 5 });
  expect(saved).toEqual([]);
});

test("exposes the position the player last reported, for reloading in another player", () => {
  const save = () => {};
  const t = createPlaybackTracker({ mediaType: "tv", id: 1, season: 1, episode: 1 }, save, () => 0);
  expect(t.position).toBe(0);
  t.onEvent(ev("timeupdate", 77));
  expect(t.position).toBe(77);
  t.onEvent({ kind: "episodechange", currentTime: 0, duration: 0, season: 1, episode: 2 });
  expect(t.position).toBe(0);
  expect(t.target).toMatchObject({ season: 1, episode: 2 });
});
