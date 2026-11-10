import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { fetchMovie, fetchProgress } from "../lib/api";
import { NoTvNote, PLAY_ON_TV, PlayButton } from "../components/PlayButton";
import { ListToggles } from "../components/ListToggles";
import { PageMessage } from "../components/Status";
import { heroAction, TitleHero } from "../components/TitleHero";
import { formatRuntime, timeLeft } from "../lib/format";

export function Movie() {
  const { id = "" } = useParams();
  const { data: m, isError, error } = useQuery({ queryKey: ["movie", id], queryFn: () => fetchMovie(id) });
  // Wait for progress too, so the button doesn't flip from Play to Resume. A failed lookup just means Play.
  const progress = useQuery({ queryKey: ["progress", "movie", id], queryFn: () => fetchProgress({ mediaType: "movie", id }) });
  if (isError) return <PageMessage>{error.message}.</PageMessage>;
  if (!m || progress.isPending) return <PageMessage>Loading…</PageMessage>;
  const saved = progress.data && !progress.data.finished ? progress.data : null;
  const meta = [m.year, m.runtime && formatRuntime(m.runtime), m.genres.join(", ")].filter(Boolean).join(" · ");
  return (
    <TitleHero title={m.title} meta={meta} overview={m.overview} backdropPath={m.backdropPath}>
      <PlayButton target={{ mediaType: "movie", id: m.id }} remoteLabel={PLAY_ON_TV} className={heroAction.play} autoFocus>
        {saved ? "▶ Resume" : "▶ Play"}
      </PlayButton>
      <NoTvNote className={heroAction.aside} />
      <ListToggles mediaType="movie" id={m.id} />
      {saved && <span className={heroAction.aside}>{timeLeft(saved.position, saved.duration)}</span>}
    </TitleHero>
  );
}
