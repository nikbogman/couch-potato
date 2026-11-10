export type SeasonEpisodes = { season: number; episodes: { episode: number; airDate: string | null }[] };
export type Episode = { season: number; episode: number };

/**
 * What to watch next in a series. `last` is the most recently watched episode (null if none yet);
 * `seasons` needs only the season of `last` and whatever follows it. `today` is YYYY-MM-DD.
 * Unfinished: that episode. Finished: the next aired episode in its season, else the first aired one of
 * the next season that has any. Null when nothing is left: the series is complete.
 * Season 0 (specials) is never suggested; an episode without an air date counts as unaired.
 */
export function nextEpisode(last: (Episode & { finished: boolean }) | null, seasons: SeasonEpisodes[], today: string): Episode | null {
  if (last && !last.finished) return { season: last.season, episode: last.episode };
  const aired = (s: SeasonEpisodes) =>
    s.episodes.filter((e) => e.airDate !== null && e.airDate <= today).sort((a, b) => a.episode - b.episode);
  const ordered = seasons.filter((s) => s.season > 0).sort((a, b) => a.season - b.season);
  if (last) {
    const here = ordered.find((s) => s.season === last.season);
    const next = here && aired(here).find((e) => e.episode > last.episode);
    if (next) return { season: last.season, episode: next.episode };
  }
  for (const s of ordered) {
    if (last && s.season <= last.season) continue;
    const first = aired(s)[0];
    if (first) return { season: s.season, episode: first.episode };
  }
  return null;
}
