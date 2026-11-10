import { expect, test } from "bun:test";
import { phoneToast } from "./Player";

test("phone commands that change playback get a toast; ones that show for themselves don't", () => {
  expect(phoneToast({ cmd: "togglePlay" }, false)).toBe("Paused from phone");
  expect(phoneToast({ cmd: "play" }, true)).toBe("Playing from phone");
  expect(phoneToast({ cmd: "seekBy", delta: -10 }, true)).toBe("Back 10 s from phone");
  expect(phoneToast({ cmd: "seekBy", delta: 30 }, true)).toBe("Forward 30 s from phone");
  for (const cmd of ["switchPlayer", "stop", "nextEpisode", "fullscreen"] as const) expect(phoneToast({ cmd }, true)).toBeNull();
  expect(phoneToast({ cmd: "setVolume", volume: 0.5 }, true)).toBeNull();
});
