import { expect, test } from "bun:test";
import { parseplayeroneMessage } from "./playerone";

const msg = (extra: Record<string, unknown>) => ({ source: "playerone-player", currentTime: 12.5, duration: 7200, ...extra });

test("maps playerone events to the shared player event shape", () => {
  for (const kind of ["play", "pause", "seeked", "ended", "timeupdate"] as const) {
    expect(parseplayeroneMessage(msg({ event: kind, percentage: 0.2 }))).toEqual({ kind, currentTime: 12.5, duration: 7200 });
  }
  expect(parseplayeroneMessage(msg({ event: "ready" }))).toEqual({ kind: "ready", currentTime: 12.5, duration: 7200 });
  expect(parseplayeroneMessage(msg({ event: "playerstatus", paused: true }))).toEqual({
    kind: "status",
    currentTime: 12.5,
    duration: 7200,
    paused: true,
  });
  expect(parseplayeroneMessage(msg({ event: "episodechange", season: 2, episode: 5 }))).toEqual({
    kind: "episodechange",
    currentTime: 12.5,
    duration: 7200,
    season: 2,
    episode: 5,
  });
});

test("missing or non-numeric times become 0", () => {
  expect(parseplayeroneMessage({ source: "playerone-player", event: "ready" })).toEqual({ kind: "ready", currentTime: 0, duration: 0 });
  expect(parseplayeroneMessage(msg({ event: "pause", currentTime: "x", duration: NaN }))).toEqual({
    kind: "pause",
    currentTime: 0,
    duration: 0,
  });
});

test("ignores other sources, unknown events and junk", () => {
  expect(parseplayeroneMessage({ ...msg({ event: "play" }), source: "other" })).toBeNull();
  expect(parseplayeroneMessage({ type: "PLAYER_EVENT", data: { event: "play" } })).toBeNull();
  expect(parseplayeroneMessage(msg({ event: "volumechange" }))).toBeNull();
  for (const junk of [null, undefined, "playerone-player", 5, []]) expect(parseplayeroneMessage(junk)).toBeNull();
});
