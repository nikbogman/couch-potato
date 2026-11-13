import type { Target } from "../../shared/types";
import { HOSTS } from "./hosts";

/** Player 1 embed URLs. `startAt` (seconds) becomes `t=`. */
function p1Url(path: string, startAt: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (startAt > 0) params.set("t", String(Math.floor(startAt)));
  params.set("autoplay", "1");
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return `${HOSTS.p1}/${path}?${params}`;
}

export const p1MovieUrl = (id: string | number, startAt = 0) => p1Url(`movie/${id}`, startAt);

/** `autonext=1` uses Player 1's own countdown; `episodes=1` (its in-player list) stays off, the title page is the picker. */
export const p1TvUrl = (id: string | number, season: number, episode: number, startAt = 0) =>
  p1Url(`tv/${id}/${season}/${episode}`, startAt, { autonext: "1" });

/** Player 2 embed URL. `startAt` (seconds) becomes `t=`; the player also resumes by itself where the viewer stopped. */
export function p2Url(target: Target, startAt = 0): string {
  const path = target.mediaType === "tv" ? `tv/${target.id}/${target.season}/${target.episode}` : `movie/${target.id}`;
  return `${HOSTS.p2}/${path}${startAt > 0 ? `?t=${Math.floor(startAt)}` : ""}`;
}

/** Player 3 embed URL. `autonext` only means something for episodes. */
export function p3Url(target: Target, startAt = 0): string {
  const params = new URLSearchParams(target.mediaType === "tv" ? { tmdb: String(target.id), season: String(target.season), episode: String(target.episode) } : { tmdb: String(target.id) });
  params.set("autoplay", "1");
  if (startAt > 0) params.set("startAt", String(Math.floor(startAt)));
  if (target.mediaType === "tv") params.set("autonext", "1");
  return `${HOSTS.p3}/embed/${target.mediaType}?${params}`;
}
