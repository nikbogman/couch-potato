import type { Target } from "../../shared/types";
import type { PlayerEvent } from "./playerEvent";

const SAVE_EVERY_MS = 10_000;
const STALL_AFTER_MS = 30_000;

/**
 * Watches a player's events and decides when to save and whether progress has gone quiet.
 * Pure: `save` and `now` are injected. Created when the player loads, so "load" is its start time.
 */
export function createTracker(save: (p: { position: number; duration: number }) => unknown, now: () => number = Date.now) {
  let position = 0;
  let duration = 0;
  let playing = false;
  let heard = false;
  let dirty = false;
  let lastEvent = now();
  let lastSave = lastEvent; // first save waits a full interval: the player may still be seeking to our start time

  const flush = async () => {
    if (!dirty || duration <= 0) return;
    dirty = false;
    lastSave = now();
    await save({ position, duration });
  };

  return {
    onEvent(e: PlayerEvent): void {
      lastEvent = now();
      heard = true;
      if (e.duration > 0) duration = e.duration;
      if (e.kind === "ready" || e.kind === "episodechange") return; // createPlaybackTracker handles episode switches
      if (e.currentTime > 0) {
        position = e.currentTime; // 0 means "not known yet" and must not overwrite a saved position
        dirty = true;
      }
      if (e.kind === "pause" || e.kind === "ended") playing = false;
      else if (e.kind === "status") playing = e.paused === false;
      else if (e.kind !== "seeked") playing = true;
      if (e.kind === "pause" || e.kind === "ended" || (playing && lastEvent - lastSave >= SAVE_EVERY_MS)) void flush();
    },
    flush,
    /** Last position the player reported, 0 before any. */
    get position() {
      return position;
    },
    /** No event for 30 s while believed playing, or no event at all 30 s after load. */
    stalled() {
      return now() - lastEvent > STALL_AFTER_MS && (playing || !heard);
    },
  };
}

/**
 * A tracker that follows what the player reports it is playing. On an `episodechange` to a different episode it saves
 * the old one where it ended, then starts a fresh tracker bound to the new one, so the new episode's early events
 * can never be written over the one that just finished. `save` is told which target each save belongs to.
 */
export function createPlaybackTracker(
  start: Target,
  save: (target: Target, p: { position: number; duration: number }) => unknown,
  now: () => number = Date.now,
) {
  const make = (target: Target) => createTracker((p) => save(target, p), now);
  let target = start;
  let current = make(target);
  return {
    onEvent(e: PlayerEvent): void {
      if (e.kind === "episodechange" && target.mediaType === "tv" && e.season !== undefined && e.episode !== undefined && (e.season !== target.season || e.episode !== target.episode)) {
        void current.flush();
        target = { ...target, season: e.season, episode: e.episode };
        current = make(target);
        current.onEvent({ ...e, currentTime: 0, duration: 0 }); // those numbers may still describe the old episode
      } else current.onEvent(e);
    },
    flush: () => current.flush(),
    get position() {
      return current.position;
    },
    stalled: () => current.stalled(),
    /** What is playing now, per the player. */
    get target() {
      return target;
    },
  };
}
