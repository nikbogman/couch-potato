/** The one event shape every player adapter produces. */
export type PlayerEvent = {
  kind: "ready" | "play" | "pause" | "seeked" | "ended" | "timeupdate" | "status" | "episodechange";
  /** Seconds; 0 when the player didn't say. */
  currentTime: number;
  /** Seconds; 0 when unknown. */
  duration: number;
  /** `status` events only. */
  paused?: boolean;
  /** `status` events only, when the player says. */
  muted?: boolean;
  volume?: number;
  /** `episodechange` events only. */
  season?: number;
  episode?: number;
};
