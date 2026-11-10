import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { fetchMovie, fetchProgress } from "../lib/api";
import { ListToggles } from "../components/ListToggles";
import { NoTvNote, PLAY_ON_TV, PlayButton } from "../components/PlayButton";
import { PlayerChoice } from "../components/PlayerChoice";
import { PageMessage } from "../components/Status";
import { heroAction, PlayGlyph, TitleHero } from "../components/TitleHero";
import { formatRuntime, timeLeft } from "../lib/format";

/** Movie title page (designs: TV · Title): eyebrow, title, "year · runtime · genre · ★ rating", Play or Resume, the list squares, Player N. */
export function Movie() {
  const { id = "" } = useParams();
  const { data: m, isError, error } = useQuery({ queryKey: ["movie", id], queryFn: () => fetchMovie(id) });
  // Wait for progress too, so the button doesn't flip from Play to Resume. A failed lookup just means Play.
  const progress = useQuery({ queryKey: ["progress", "movie", id], queryFn: () => fetchProgress({ mediaType: "movie", id }) });
  if (isError) return <PageMessage>{error.message}.</PageMessage>;
  if (!m || progress.isPending) return <PageMessage>Loading…</PageMessage>;
  const saved = progress.data && !progress.data.finished ? progress.data : null;
  return (
    <TitleHero
      eyebrow="Movie"
      title={m.title}
      meta={[m.year, m.runtime ? formatRuntime(m.runtime) : null, m.genres[0], m.rating && `★ ${m.rating}`]}
      overview={m.overview}
      backdropPath={m.backdropPath}
    >
      <PlayButton target={{ mediaType: "movie", id: m.id }} remoteLabel={PLAY_ON_TV} className={heroAction.play} autoFocus>
        <PlayGlyph />
        {saved ? "Resume" : "Play"}
      </PlayButton>
      <ListToggles mediaType="movie" id={m.id} />
      <PlayerChoice />
      <NoTvNote className={heroAction.aside} />
      {saved && <span className={heroAction.aside}>{timeLeft(saved.position, saved.duration)}</span>}
    </TitleHero>
  );
}
