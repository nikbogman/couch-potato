// Playback commands (phone -> TV) and the now-playing state (TV -> phone), with validators for both: the Worker relays them.
import { PLAYER_IDS, type PlayerId, type Target } from "./types";

/** What an adapter can say to its player. `seekBy` is relative to the current position; `togglePlay` flips the known state. */
export type PlaybackCommand =
  | { cmd: "play" }
  | { cmd: "pause" }
  | { cmd: "togglePlay" }
  | { cmd: "seekTo"; time: number }
  | { cmd: "seekBy"; delta: number }
  | { cmd: "setVolume"; volume: number }
  | { cmd: "setMuted"; muted: boolean }
  | { cmd: "getStatus" };

/** What a phone can ask the TV: playback commands plus what the TV's player screen does itself. `fullscreen` toggles. */
export type RemoteCommand = PlaybackCommand | { cmd: "nextEpisode" } | { cmd: "switchPlayer" } | { cmd: "stop" } | { cmd: "fullscreen" };

/** What the TV reports while the player is open. `null` (idle) is sent everywhere else. */
export type NowPlaying = {
  target: Target;
  title: string;
  /** "S1 E2" for episodes, null for movies. */
  episode: string | null;
  /** The episode's own name ("Pilot"), when known. */
  episodeName: string | null;
  /** TMDB backdrop path. */
  art: string | null;
  position: number;
  duration: number;
  playing: boolean;
  muted: boolean;
  /** 0..1 */
  volume: number;
  player: PlayerId;
  /** An aired next episode exists. */
  canNext: boolean;
  /** The video fills the screen: our band is hidden. */
  fullscreen: boolean;
};

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);

/** Validates untrusted JSON. */
export function parseRemoteCommand(c: any): RemoteCommand | null {
  switch (c?.cmd) {
    case "play": case "pause": case "togglePlay": case "getStatus": case "nextEpisode": case "switchPlayer": case "stop": case "fullscreen":
      return { cmd: c.cmd };
    case "seekTo": return num(c.time) && c.time >= 0 ? { cmd: "seekTo", time: c.time } : null;
    case "seekBy": return num(c.delta) ? { cmd: "seekBy", delta: c.delta } : null;
    case "setVolume": return num(c.volume) ? { cmd: "setVolume", volume: clamp01(c.volume) } : null;
    case "setMuted": return typeof c.muted === "boolean" ? { cmd: "setMuted", muted: c.muted } : null;
  }
  return null;
}

const str = (v: unknown, max = 300) => typeof v === "string" && v.length <= max;
const strOrNull = (v: unknown) => v === null || str(v);

/** Validates untrusted JSON; `undefined` means malformed (null is a valid idle state). */
export function parseNowPlaying(s: any, parseTarget: (t: any) => Target | null): NowPlaying | null | undefined {
  if (s === null) return null;
  const target = parseTarget(s?.target);
  if (
    !target || !str(s.title) || !strOrNull(s.episode) || !strOrNull(s.art) ||
    !num(s.position) || s.position < 0 || !num(s.duration) || s.duration < 0 ||
    typeof s.playing !== "boolean" || typeof s.muted !== "boolean" || !num(s.volume) ||
    !PLAYER_IDS.includes(s.player) || typeof s.canNext !== "boolean"
  )
    return undefined;
  const { title, episode, art, position, duration, playing, muted, volume, player, canNext } = s;
  // `fullscreen` is newer than the rest: a TV page from before it reads as not fullscreen.
  return { target, title, episode, art, position, duration, playing, muted, volume: clamp01(volume), player, canNext, fullscreen: s.fullscreen === true, episodeName: str(s.episodeName) ? s.episodeName : null };
}
