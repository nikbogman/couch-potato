// The TV side of playback: what the player is doing right now, and how often that is reported to the phone.
import { clamp01, type PlaybackCommand } from "../../shared/playback";
import type { PlayerEvent } from "./playerEvent";

/** The player's live numbers, from its events and from our own commands (playerone never reports volume). */
export function createPlaybackState() {
  const s = { position: 0, duration: 0, playing: false, muted: false, volume: 1 };
  return {
    get: () => s,
    reset(position: number) {
      Object.assign(s, { position, duration: 0, playing: false });
    },
    event(e: PlayerEvent) {
      if (e.kind === "ready" || e.kind === "episodechange") {
        if (e.kind === "episodechange") Object.assign(s, { position: 0, duration: 0 });
        return;
      }
      if (e.currentTime > 0) s.position = e.currentTime;
      if (e.duration > 0) s.duration = e.duration;
      if (e.kind === "pause" || e.kind === "ended") s.playing = false;
      else if (e.kind === "status") {
        if (e.paused !== undefined) s.playing = !e.paused;
        if (e.muted !== undefined) s.muted = e.muted;
        if (e.volume !== undefined) s.volume = e.volume;
      } else if (e.kind !== "seeked") s.playing = true;
    },
    /** Optimistic update for a command we just sent, so the phone sees it before the player answers. */
    command(c: PlaybackCommand) {
      if (c.cmd === "play") s.playing = true;
      else if (c.cmd === "pause") s.playing = false;
      else if (c.cmd === "togglePlay") s.playing = !s.playing;
      else if (c.cmd === "setMuted") s.muted = c.muted;
      else if (c.cmd === "setVolume") s.volume = clamp01(c.volume);
      else if (c.cmd === "seekTo") s.position = c.time;
      else if (c.cmd === "seekBy") s.position = Math.max(0, s.position + c.delta);
    },
  };
}

/** Sends state on every event except `timeupdate`, which goes at most once per `every` ms. */
export function createStateReporter(send: () => void, every = 1000, now: () => number = Date.now) {
  let last = -Infinity;
  const push = () => {
    last = now();
    send();
  };
  return {
    event(kind: PlayerEvent["kind"]) {
      if (kind !== "timeupdate" || now() - last >= every) push();
    },
    push,
  };
}
