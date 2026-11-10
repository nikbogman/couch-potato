import type { PlayerEvent } from "./playerEvent";

const KINDS: Record<string, PlayerEvent["kind"]> = {
  ready: "ready",
  play: "play",
  pause: "pause",
  seeked: "seeked",
  ended: "ended",
  timeupdate: "timeupdate",
  playerstatus: "status",
  episodechange: "episodechange",
};

const seconds = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/** Turn a raw `message` payload into a PlayerEvent. Anything not tagged `source: <source>`, or an unknown event, is null. playertwo speaks the same dialect under its own tag. */
export function parseTaggedMessage(source: string, data: unknown): PlayerEvent | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.source !== source) return null;
  const kind = typeof m.event === "string" ? KINDS[m.event] : undefined;
  if (!kind) return null;
  const e: PlayerEvent = { kind, currentTime: seconds(m.currentTime), duration: seconds(m.duration) };
  if (kind === "status") {
    if (typeof m.paused === "boolean") e.paused = m.paused;
    if (typeof m.muted === "boolean") e.muted = m.muted;
    if (typeof m.volume === "number" && m.volume >= 0 && m.volume <= 1) e.volume = m.volume;
  }
  if (kind === "episodechange") {
    if (typeof m.season === "number") e.season = m.season;
    if (typeof m.episode === "number") e.episode = m.episode;
  }
  return e;
}

export const parseplayeroneMessage = (data: unknown) => parseTaggedMessage("playerone-player", data);
