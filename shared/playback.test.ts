import { expect, test } from "bun:test";
import { parseNowPlaying, parseRemoteCommand } from "./playback";
import { parseTarget } from "./protocol";

test("remote commands are validated and volume is clamped", () => {
  expect(parseRemoteCommand({ cmd: "seekTo", time: 12 })).toEqual({ cmd: "seekTo", time: 12 });
  expect(parseRemoteCommand({ cmd: "seekBy", delta: -30 })).toEqual({ cmd: "seekBy", delta: -30 });
  expect(parseRemoteCommand({ cmd: "setVolume", volume: 3 })).toEqual({ cmd: "setVolume", volume: 1 });
  expect(parseRemoteCommand({ cmd: "stop", junk: 1 })).toEqual({ cmd: "stop" });
  for (const bad of [null, {}, { cmd: "rm" }, { cmd: "seekTo" }, { cmd: "seekTo", time: -1 }, { cmd: "setMuted", muted: "yes" }, { cmd: "seekBy", delta: NaN }])
    expect(parseRemoteCommand(bad)).toBeNull();
});

const np = { target: { mediaType: "movie", id: 1 }, title: "T", episode: null, art: null, position: 1, duration: 2, playing: true, muted: false, volume: 0.5, player: "playerone", canNext: false };

test("now-playing state: null is idle, malformed is undefined", () => {
  expect(parseNowPlaying(null, parseTarget)).toBeNull();
  expect(parseNowPlaying(np, parseTarget)).toEqual(np as never);
  expect(parseNowPlaying({ ...np, player: "x" }, parseTarget)).toBeUndefined();
  expect(parseNowPlaying({ ...np, position: "1" }, parseTarget)).toBeUndefined();
  expect(parseNowPlaying({ ...np, target: {} }, parseTarget)).toBeUndefined();
});
