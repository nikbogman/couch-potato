import { PLAYER_IDS, type PlayerId, type Target } from "../../shared/types";
import { playerthreeUrl, playeroneMovieUrl, playeroneTvUrl, playertwoUrl } from "./embedUrls";
import { clamp01, type PlaybackCommand } from "../../shared/playback";
import type { PlayerEvent } from "./playerEvent";
import { parseTaggedMessage, parseplayeroneMessage } from "./playerone";
import { parseplayerthreeMessage } from "./playerthree";


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

/** The `{action}` dialect that playerone, playertwo and playerthree share. */
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
  playerone: {
    id: "playerone",
    label: "1",
    url: (t, startAt) => (t.mediaType === "tv" ? playeroneTvUrl(t.id, t.season, t.episode, startAt) : playeroneMovieUrl(t.id, startAt)),
    // playerone is trusted by its `source` tag, not the origin.
    parse(_origin, data) {
      const e = parseplayeroneMessage(data);
      return e ? [e] : [];
    },
    command: actionCommand,
  },
  playertwo: {
    id: "playertwo",
    label: "2",
    url: playertwoUrl,
    // Tagged like playerone. It has no `ready`, so the first valid event is preceded by one.
    parse(_origin, data, _current, first) {
      const e = parseTaggedMessage("playertwo-player", data);
      return !e ? [] : first ? [{ kind: "ready", currentTime: e.currentTime, duration: e.duration }, e] : [e];
    },
    command: actionCommand,
  },
  playerthree: {
    id: "playerthree",
    label: "3",
    url: playerthreeUrl,
    parse: (origin, data, current) => parseplayerthreeMessage(origin, data, current),
    command: actionCommand,
  },
};

export { PLAYER_IDS };
/** Where playback starts: Player 3 (playerthree), the most reliable lately. 1 and 2 stay as fallbacks. */
export const DEFAULT_PLAYER: PlayerId = "playerthree";

export const playerFromParam = (v: string | null): PlayerId => PLAYER_IDS.find((p) => p === v) ?? DEFAULT_PLAYER;
/** The player `step` places after `from` in the list, wrapping around. */
export const cyclePlayer = (from: PlayerId, step: 1 | -1 = 1): PlayerId => PLAYER_IDS[(PLAYER_IDS.indexOf(from) + step + PLAYER_IDS.length) % PLAYER_IDS.length]!;

/** playerone gets this long to say anything before we fall back to playertwo. */
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
