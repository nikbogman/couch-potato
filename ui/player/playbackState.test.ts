import { expect, test } from "bun:test";
import { createPlaybackState, createStateReporter } from "./playbackState";

test("playback state follows events and optimistic commands", () => {
  const s = createPlaybackState();
  s.event({ kind: "timeupdate", currentTime: 10, duration: 100 });
  expect(s.get()).toMatchObject({ position: 10, duration: 100, playing: true });
  s.event({ kind: "pause", currentTime: 11, duration: 100 });
  expect(s.get().playing).toBe(false);
  s.event({ kind: "status", currentTime: 12, duration: 100, paused: false, muted: true, volume: 0.3 });
  expect(s.get()).toMatchObject({ position: 12, playing: true, muted: true, volume: 0.3 });
  s.command({ cmd: "seekBy", delta: -30 });
  expect(s.get().position).toBe(0);
  s.command({ cmd: "togglePlay" });
  expect(s.get().playing).toBe(false);
  s.command({ cmd: "setVolume", volume: 0.8 });
  expect(s.get().volume).toBe(0.8);
});

test("reporter throttles timeupdate to one per second but sends everything else at once", () => {
  let t = 0;
  let sent = 0;
  const r = createStateReporter(() => sent++, 1000, () => t);
  r.event("timeupdate"); // first goes out
  t = 400;
  r.event("timeupdate");
  t = 999;
  r.event("timeupdate");
  expect(sent).toBe(1);
  r.event("pause");
  r.event("seeked");
  expect(sent).toBe(3);
  t = 1500;
  r.event("timeupdate"); // 1s after the last push? last push was at t=999 -> 501ms ago
  expect(sent).toBe(3);
  t = 2000;
  r.event("timeupdate");
  expect(sent).toBe(4);
});
