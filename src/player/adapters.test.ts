import { expect, test } from "bun:test";
import type { Target } from "../../shared/types";
import { ADAPTERS, createSilenceWatch, cyclePlayer, mmss, playerFromParam, resumePoint } from "./adapters";

const movie: Target = { mediaType: "movie", id: 603 };
const ep: Target = { mediaType: "tv", id: 1396, season: 1, episode: 2 };

test("each adapter builds its own url for the same target", () => {
  expect(ADAPTERS.playerone.url(movie, 90)).toBe("https://player-one.test/movie/603?t=90&autoplay=1");
  expect(ADAPTERS.playerone.url(ep, 0)).toBe("https://player-one.test/tv/1396/1/2?autoplay=1&autonext=1");
});

test("each adapter ignores the other's messages", () => {
  const vn = { source: "playerone-player", event: "timeupdate", currentTime: 5, duration: 100 };
  const eb = { type: "PLAYER_EVENT", data: { player_info: { tmdb: 603 }, player_status: "timeupdate", player_progress: 5, player_duration: 100 } };
  const want = [{ kind: "timeupdate" as const, currentTime: 5, duration: 100 }];
  expect(ADAPTERS.playerone.parse("https://player-one.test", vn, movie, false)).toEqual(want);
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb, movie, false)).toEqual(want);
  expect(ADAPTERS.playerone.parse("https://player-three.test", eb, movie, false)).toEqual([]);
  expect(ADAPTERS.playerthree.parse("https://player-one.test", vn, movie, false)).toEqual([]);
});

test("silence watch fires once after the timeout when nothing is heard", () => {
  const { timers, advance } = fakeTimers();
  let fired = 0;
  createSilenceWatch(15_000, () => fired++, timers);
  advance(14_999);
  expect(fired).toBe(0);
  advance(1);
  expect(fired).toBe(1);
  advance(60_000);
  expect(fired).toBe(1);
});

test("silence watch stays quiet once an event is heard, or after cancel", () => {
  const { timers, advance } = fakeTimers();
  let fired = 0;
  const w = createSilenceWatch(15_000, () => fired++, timers);
  advance(5000);
  w.heard();
  advance(60_000);
  const w2 = createSilenceWatch(15_000, () => fired++, timers);
  w2.cancel();
  advance(60_000);
  expect(fired).toBe(0);
});

test("mm:ss and h:mm:ss", () => {
  expect(mmss(0)).toBe("0:00");
  expect(mmss(75.9)).toBe("1:15");
  expect(mmss(3725)).toBe("1:02:05");
});

test("resume point: the player's own position wins, else our loaded start only for the same title", () => {
  const loaded = { target: ep, startAt: 300 };
  expect(resumePoint({ target: ep, position: 42 }, loaded)).toEqual({ target: ep, startAt: 42 });
  expect(resumePoint({ target: ep, position: 0 }, loaded)).toEqual({ target: ep, startAt: 300 });
  const next: Target = { ...ep, episode: 3 };
  expect(resumePoint({ target: next, position: 0 }, loaded)).toEqual({ target: next, startAt: 0 });
  expect(resumePoint(null, loaded)).toEqual({ target: ep, startAt: 300 });
});

function fakeTimers() {
  let now = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        pending.set(next, { at: now + ms, fn });
        return next++;
      },
      clear: (h: unknown) => void pending.delete(h as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [h, t] of [...pending]) if (t.at <= now) (pending.delete(h), t.fn());
    },
  };
}

const now = { position: 100, duration: 1000, playing: true };

test("playerone commands use { action }; togglePlay becomes an explicit play or pause", () => {
  const c = (cmd: Parameters<typeof ADAPTERS.playerone.command>[0]) => ADAPTERS.playerone.command(cmd, now);
  expect(c({ cmd: "play" })).toEqual({ action: "play" });
  expect(c({ cmd: "pause" })).toEqual({ action: "pause" });
  expect(c({ cmd: "togglePlay" })).toEqual({ action: "pause" });
  expect(ADAPTERS.playerone.command({ cmd: "togglePlay" }, { ...now, playing: false })).toEqual({ action: "play" });
  expect(c({ cmd: "getStatus" })).toEqual({ action: "getStatus" });
  expect(c({ cmd: "seekTo", time: 42 })).toEqual({ action: "seek", time: 42 });
  expect(c({ cmd: "seekBy", delta: 30 })).toEqual({ action: "seek", time: 130 });
  expect(c({ cmd: "seekBy", delta: -300 })).toEqual({ action: "seek", time: 0 });
  expect(c({ cmd: "seekBy", delta: 5000 })).toEqual({ action: "seek", time: 1000 });
  expect(c({ cmd: "setVolume", volume: 1.5 })).toEqual({ action: "setVolume", volume: 1 });
  expect(c({ cmd: "setMuted", muted: true })).toEqual({ action: "mute" });
  expect(c({ cmd: "setMuted", muted: false })).toEqual({ action: "unmute" });
});

test("playertwo and playerthree: urls, events and the shared command dialect", () => {
  expect(ADAPTERS.playertwo.url(movie, 90)).toBe("https://player-two.test/movie/603?t=90");
  expect(ADAPTERS.playertwo.url(ep, 0)).toBe("https://player-two.test/tv/1396/1/2");
  expect(ADAPTERS.playerthree.url(movie, 90)).toBe("https://player-three.test/embed/movie?tmdb=603&autoplay=1&startAt=90");
  expect(ADAPTERS.playerthree.url(ep, 0)).toBe("https://player-three.test/embed/tv?tmdb=1396&season=1&episode=2&autoplay=1&autonext=1");

  const vs = { source: "playertwo-player", event: "pause", currentTime: 5, duration: 100 };
  expect(ADAPTERS.playertwo.parse("https://player-two.test", vs, movie, false)).toEqual([{ kind: "pause", currentTime: 5, duration: 100 }]);
  expect(ADAPTERS.playertwo.parse("https://player-two.test", vs, movie, true)[0]).toEqual({ kind: "ready", currentTime: 5, duration: 100 });
  expect(ADAPTERS.playertwo.parse("https://player-one.test", { ...vs, source: "playerone-player" }, movie, false)).toEqual([]);

  const eb = (status: string, extra = {}) => ({ type: "PLAYER_EVENT", data: { player_info: { tmdb: 603 }, player_status: status, player_progress: 5, player_duration: 100, ...extra } });
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb("paused"), movie, false)).toEqual([{ kind: "pause", currentTime: 5, duration: 100 }]);
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb("completed"), movie, false)[0]?.kind).toBe("ended");
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb("playerstatus", { state: "paused", muted: true }), movie, false)[0]).toMatchObject({ kind: "status", paused: true, muted: true });
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb("next_episode", { player_info: { tmdb: 1396 }, next_season: 1, next_episode: 3 }), ep, false)).toEqual([{ kind: "episodechange", currentTime: 5, duration: 100, season: 1, episode: 3 }]);
  expect(ADAPTERS.playerthree.parse("https://player-three.test", eb("buffering"), movie, false)).toEqual([]);
  expect(ADAPTERS.playerthree.parse("https://elsewhere.test", eb("paused"), movie, false)).toEqual([]);
  expect(ADAPTERS.playerthree.parse("https://player-three.test", { ...eb("paused"), data: { ...eb("paused").data, player_info: { tmdb: 1 } } }, movie, false)).toEqual([]);

  const now = { position: 100, duration: 1000, playing: true };
  for (const id of ["playerone", "playertwo", "playerthree"] as const) {
    expect(ADAPTERS[id].command({ cmd: "seekBy", delta: 30 }, now)).toEqual({ action: "seek", time: 130 });
    expect(ADAPTERS[id].command({ cmd: "togglePlay" }, now)).toEqual({ action: "pause" });
  }
});

test("players cycle in order and wrap; unknown ?player= falls back to the first", () => {
  expect(cyclePlayer("playerone")).toBe("playertwo");
  expect(cyclePlayer("playerthree")).toBe("playerone");
  expect(cyclePlayer("playerone", -1)).toBe("playerthree");
  expect(playerFromParam("playertwo")).toBe("playertwo");
  expect(playerFromParam("nope")).toBe("playerthree");
  expect(playerFromParam(null)).toBe("playerthree");
});
