import type { Target } from "../../shared/types";

/** playerone embed URLs. `startAt` (seconds) becomes `t=`. */
function playeroneUrl(path: string, startAt: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (startAt > 0) params.set("t", String(Math.floor(startAt)));
  params.set("autoplay", "1");
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return `https://player-one.test/${path}?${params}`;
}

export const playeroneMovieUrl = (id: string | number, startAt = 0) => playeroneUrl(`movie/${id}`, startAt);

/** `autonext=1` uses playerone's own countdown; `episodes=1` (its in-player list) stays off, the title page is the picker. */
export const playeroneTvUrl = (id: string | number, season: number, episode: number, startAt = 0) =>
  playeroneUrl(`tv/${id}/${season}/${episode}`, startAt, { autonext: "1" });

/** playertwo embed URL. `startAt` (seconds) becomes `t=`; the player also resumes by itself where the viewer stopped. */
export function playertwoUrl(target: Target, startAt = 0): string {
  const path = target.mediaType === "tv" ? `tv/${target.id}/${target.season}/${target.episode}` : `movie/${target.id}`;
  return `https://player-two.test/${path}${startAt > 0 ? `?t=${Math.floor(startAt)}` : ""}`;
}

/** playerthree embed URL. `autonext` only means something for episodes. */
export function playerthreeUrl(target: Target, startAt = 0): string {
  const params = new URLSearchParams(target.mediaType === "tv" ? { tmdb: String(target.id), season: String(target.season), episode: String(target.episode) } : { tmdb: String(target.id) });
  params.set("autoplay", "1");
  if (startAt > 0) params.set("startAt", String(Math.floor(startAt)));
  if (target.mediaType === "tv") params.set("autonext", "1");
  return `https://player-three.test/embed/${target.mediaType}?${params}`;
}
