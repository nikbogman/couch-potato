import type { Target } from "../../shared/types";
import type { PlayerEvent } from "./playerEvent";

import { HOSTS } from "./hosts";

const KINDS: Record<string, PlayerEvent["kind"]> = {
  ready: "ready",
  playing: "play",
  paused: "pause",
  seeked: "seeked",
  timeupdate: "timeupdate",
  completed: "ended",
  playerstatus: "status",
};

const seconds = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** A `message` from an Player 3 iframe as shared PlayerEvents. Other origins, other titles and statuses we don't use (buffering, server_changed, error) are []. */
export function parseEnvelopeMessage(origin: string, data: unknown, current: Target): PlayerEvent[] {
  if (origin !== HOSTS.p3 || typeof data !== "object" || data === null) return [];
  const m = data as { type?: unknown; data?: unknown };
  if (m.type !== "PLAYER_EVENT" || typeof m.data !== "object" || m.data === null) return [];
  const d = m.data as Record<string, any>;
  if (d.player_info?.tmdb != null && String(d.player_info.tmdb) !== String(current.id)) return [];
  const currentTime = seconds(d.player_progress);
  const duration = seconds(d.player_duration);

  if (d.player_status === "next_episode") {
    return typeof d.next_season === "number" && typeof d.next_episode === "number"
      ? [{ kind: "episodechange", currentTime, duration, season: d.next_season, episode: d.next_episode }]
      : [];
  }
  const kind = typeof d.player_status === "string" ? KINDS[d.player_status] : undefined;
  if (!kind) return [];
  const e: PlayerEvent = { kind, currentTime, duration };
  if (kind === "status") {
    if (typeof d.state === "string") e.paused = d.state !== "playing";
    if (typeof d.muted === "boolean") e.muted = d.muted;
    if (typeof d.volume === "number" && d.volume >= 0 && d.volume <= 1) e.volume = d.volume;
  }
  return [e];
}
