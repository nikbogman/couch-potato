import { PLAYER_IDS, type PlayerId, type Target } from "../../shared/types";
import { p3Url, p1MovieUrl, p1TvUrl, p2Url } from "./embedUrls";
import { clamp01, type PlaybackCommand } from "../../shared/playback";
import type { PlayerEvent } from "./playerEvent";
import { parseTaggedMessage } from "./tagged";
import { HOSTS, tagOf } from "./hosts";
import { parseEnvelopeMessage } from "./envelope";


/** What `command` needs to know about the player: where it is, and whether it is playing. */
export type PlaybackNow = { position: number; duration: number; playing: boolean };

/** One embed player behind one shape: the app only talks to this. */
export type PlayerAdapter = {
  id: PlayerId;
  label: string;
  url(target: Target, startAt: number): string;
  /** A `message` event's origin and data to shared events. `current` is what is being tracked; `first` is true until the first valid event arrives. */
  parse(origin: string, data: unknown, current: Target, first: boolean): PlayerEvent[];
  /** The player's postMessage payload for a command. Absolute (never a toggle), so delivering it twice is harmless. */
  command(cmd: PlaybackCommand, now: PlaybackNow): object;
};

const seekTime = (cmd: PlaybackCommand, now: PlaybackNow) => {
  const to = cmd.cmd === "seekTo" ? cmd.time : cmd.cmd === "seekBy" ? now.position + cmd.delta : 0;
  // Whole seconds, so every player gets an integer.
  return Math.round(Math.max(0, now.duration > 0 ? Math.min(to, now.duration) : to));
};

/** The `{action}` dialect that Player 1, Player 2 and Player 3 share. */
const actionCommand = (cmd: PlaybackCommand, now: PlaybackNow): object => {
  switch (cmd.cmd) {
    case "seekTo": case "seekBy": return { action: "seek", time: seekTime(cmd, now) };
    case "setVolume": return { action: "setVolume", volume: clamp01(cmd.volume) };
    case "setMuted": return { action: cmd.muted ? "mute" : "unmute" };
    case "togglePlay": return { action: now.playing ? "pause" : "play" };
    default: return { action: cmd.cmd };
  }
};

export const ADAPTERS: Record<PlayerId, PlayerAdapter> = {
  p1: {
    id: "p1",
    label: "1",
    url: (t, startAt) => (t.mediaType === "tv" ? p1TvUrl(t.id, t.season, t.episode, startAt) : p1MovieUrl(t.id, startAt)),
    // Player 1 is trusted by its `source` tag, not the origin.
    parse(_origin, data) {
      const e = parseTaggedMessage(tagOf(HOSTS.p1), data);
      return e ? [e] : [];
    },
    command: actionCommand,
  },
  p2: {
    id: "p2",
    label: "2",
    url: p2Url,
    // Tagged like Player 1. It has no `ready`, so the first valid event is preceded by one.
    parse(_origin, data, _current, first) {
      const e = parseTaggedMessage(tagOf(HOSTS.p2), data);
      return !e ? [] : first ? [{ kind: "ready", currentTime: e.currentTime, duration: e.duration }, e] : [e];
    },
    command: actionCommand,
  },
  p3: {
    id: "p3",
    label: "3",
    url: p3Url,
    parse: (origin, data, current) => parseEnvelopeMessage(origin, data, current),
    command: actionCommand,
  },
};

export { PLAYER_IDS };
/** Where playback starts: Player 3 (Player 3), the most reliable lately. 1 and 2 stay as fallbacks. */
export const DEFAULT_PLAYER: PlayerId = "p3";

export const playerFromParam = (v: string | null): PlayerId => PLAYER_IDS.find((p) => p === v) ?? DEFAULT_PLAYER;
/** The player `step` places after `from` in the list, wrapping around. */
export const cyclePlayer = (from: PlayerId, step: 1 | -1 = 1): PlayerId => PLAYER_IDS[(PLAYER_IDS.indexOf(from) + step + PLAYER_IDS.length) % PLAYER_IDS.length]!;

/** Player 1 gets this long to say anything before we fall back to Player 2. */
export const FALLBACK_AFTER_MS = 15_000;

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

/** Calls `onSilent` once if neither `heard()` nor `cancel()` happens within `ms`. Timers are injectable for tests. */
export function createSilenceWatch(ms: number, onSilent: () => void, timers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as never) }) {
  const handle = timers.set(onSilent, ms);
  const stop = () => timers.clear(handle);
  return { heard: stop, cancel: stop };
}

/** "75" -> "1:15", "3725" -> "1:02:05". */
export function mmss(s: number): string {
  const t = Math.floor(s);
  const h = Math.floor(t / 3600);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${sec}` : `${Math.floor(t / 60)}:${sec}`;
}

const same = (a: Target, b: Target) => a.mediaType === b.mediaType && String(a.id) === String(b.id) && (a.mediaType === "movie" || (b.mediaType === "tv" && a.season === b.season && a.episode === b.episode));

/**
 * Where to reload when switching players: what the player reports playing and how far in. With no position yet, we fall back to
 * the start we loaded with, but only if it is still the same title (after an auto-next that start belongs to the old episode).
 */
export function resumePoint(now: { target: Target; position: number } | null, loaded: { target: Target; startAt: number }): { target: Target; startAt: number } {
  if (!now) return { target: loaded.target, startAt: loaded.startAt };
  return { target: now.target, startAt: now.position > 0 ? now.position : same(now.target, loaded.target) ? loaded.startAt : 0 };
}
