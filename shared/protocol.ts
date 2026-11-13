// WebSocket messages between the server, TV screens and phone remotes. Shared by client and server.
import type { Target } from "./types";
import { parseNowPlaying, parseRemoteCommand, type NowPlaying, type RemoteCommand } from "./playback";

export type Role = "tv" | "remote";

/**
 * Close codes the relay uses when it ends a socket on purpose. The client doesn't reconnect after these.
 * `replaced`: the same account connected another TV (or phone). `signedOut`: the TV was unpaired.
 */
export const CLOSE = { replaced: 4001, signedOut: 4002 } as const;

/** Client → server. The role (TV or phone) comes from the session cookie, not from the client. */
export type ClientMessage =
  /** Remote: send the account's TV to this title/episode. Relayed unchanged. */
  | { type: "play"; target: Target }
  /** Remote: playback command for the account's TV. Relayed unchanged. */
  | { type: "command"; command: RemoteCommand }
  /** TV: what is playing now (`null` = idle). Relayed to the phone and cached for when it joins later. */
  | { type: "state"; state: NowPlaying | null };

/** Server → client. */
export type ServerMessage =
  /** To the phone: is the TV open? Sent on join and whenever the TV joins or leaves. */
  | { type: "presence"; tv: boolean }
  /** To the TV: whether its phone is connected (0 or 1). Sent on join and whenever the phone joins or leaves. */
  | { type: "remotes"; count: number }
  /** To the TV: navigate to the player for this title/episode. */
  | { type: "play"; target: Target }
  /** To the TV: run this playback command. */
  | { type: "command"; command: RemoteCommand }
  /** To the TV when the phone joins: ask the player for its status and send fresh state. */
  | { type: "sync" }
  /** To the phone: the TV's now-playing state, or null when idle. */
  | { type: "state"; state: NowPlaying | null };

const isId = (v: unknown) => typeof v === "string" ? /^\d+$/.test(v) : Number.isInteger(v) && (v as number) > 0;
const isCount = (v: unknown, min: number) => Number.isInteger(v) && (v as number) >= min;

export function parseTarget(t: any): Target | null {
  if (!t || !isId(t.id)) return null;
  if (t.mediaType === "movie") return { mediaType: "movie", id: t.id };
  if (t.mediaType === "tv" && isCount(t.season, 0) && isCount(t.episode, 1))
    return { mediaType: "tv", id: t.id, season: t.season, episode: t.episode };
  return null;
}

/** Validates untrusted JSON text. Returns null for anything that isn't a well-formed message. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let m: any;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (m?.type === "play") {
    const target = parseTarget(m.target);
    return target && { type: "play", target };
  }
  if (m?.type === "command") {
    const command = parseRemoteCommand(m.command);
    return command && { type: "command", command };
  }
  if (m?.type === "state") {
    const state = parseNowPlaying(m.state, parseTarget);
    return state === undefined ? null : { type: "state", state };
  }
  return null;
}

/** Validates a server message on the client (same trust rules: it's still JSON off the wire). */
export function parseServerMessage(raw: string): ServerMessage | null {
  let m: any;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (m?.type === "presence" && typeof m.tv === "boolean") return { type: "presence", tv: m.tv };
  if (m?.type === "remotes" && isCount(m.count, 0)) return { type: "remotes", count: m.count };
  if (m?.type === "play") {
    const target = parseTarget(m.target);
    return target && { type: "play", target };
  }
  if (m?.type === "command") {
    const command = parseRemoteCommand(m.command);
    return command && { type: "command", command };
  }
  if (m?.type === "sync") return { type: "sync" };
  if (m?.type === "state") {
    const state = parseNowPlaying(m.state, parseTarget);
    return state === undefined ? null : { type: "state", state };
  }
  return null;
}

/** Player route for a target. Shared so the TV navigates exactly where its own Play links go. */
export const watchPath = (t: Target) =>
  t.mediaType === "movie" ? `/watch/movie/${t.id}` : `/watch/tv/${t.id}/${t.season}/${t.episode}`;
