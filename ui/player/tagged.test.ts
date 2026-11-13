import { expect, test } from "bun:test";
import { HOSTS, tagOf } from "./hosts";
import { parseTaggedMessage } from "./tagged";

const parse = (data: unknown) => parseTaggedMessage(tagOf(HOSTS.p1), data);

const msg = (extra: Record<string, unknown>) => ({ source: tagOf(HOSTS.p1), currentTime: 12.5, duration: 7200, ...extra });

test("maps player 1 events to the shared player event shape", () => {
  for (const kind of ["play", "pause", "seeked", "ended", "timeupdate"] as const) {
    expect(parse(msg({ event: kind, percentage: 0.2 }))).toEqual({ kind, currentTime: 12.5, duration: 7200 });
  }
  expect(parse(msg({ event: "ready" }))).toEqual({ kind: "ready", currentTime: 12.5, duration: 7200 });
  expect(parse(msg({ event: "playerstatus", paused: true }))).toEqual({
    kind: "status",
    currentTime: 12.5,
    duration: 7200,
    paused: true,
  });
  expect(parse(msg({ event: "episodechange", season: 2, episode: 5 }))).toEqual({
    kind: "episodechange",
    currentTime: 12.5,
    duration: 7200,
    season: 2,
    episode: 5,
  });
});

test("missing or non-numeric times become 0", () => {
  expect(parse({ source: tagOf(HOSTS.p1), event: "ready" })).toEqual({ kind: "ready", currentTime: 0, duration: 0 });
  expect(parse(msg({ event: "pause", currentTime: "x", duration: NaN }))).toEqual({
    kind: "pause",
    currentTime: 0,
    duration: 0,
  });
});

test("ignores other sources, unknown events and junk", () => {
  expect(parse({ ...msg({ event: "play" }), source: "other" })).toBeNull();
  expect(parse({ type: "PLAYER_EVENT", data: { event: "play" } })).toBeNull();
  expect(parse(msg({ event: "volumechange" }))).toBeNull();
  for (const junk of [null, undefined, tagOf(HOSTS.p1), 5, []]) expect(parse(junk)).toBeNull();
});
