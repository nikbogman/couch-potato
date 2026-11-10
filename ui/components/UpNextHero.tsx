import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { fetchMovie, fetchSeries } from "../lib/api";
import { useList } from "../lib/collection";
import { formatRuntime } from "../lib/format";
import { ListToggles } from "./ListToggles";
import { PlayButton } from "./PlayButton";
import { heroAction, PlayGlyph, TitleHero } from "./TitleHero";

/** TV Home's top (designs: TV · Home): the newest title in To watch, with Play, Watched and More info. Nothing while loading or when To watch is empty. */
export function UpNextHero() {
  const first = useList("to_watch").data?.pages[0]?.items[0];
  const isTv = first?.mediaType === "tv";
  const id = String(first?.id ?? "");
  const movie = useQuery({ queryKey: ["movie", id], queryFn: () => fetchMovie(id), enabled: !!first && !isTv });
  const series = useQuery({ queryKey: ["progress", "tv", id], queryFn: () => fetchSeries(id), enabled: !!first && isTv, gcTime: 0 });
  if (!first) return null;
  const m = movie.data;
  const s = series.data;
  if (isTv ? !s : !m) return null;
  const rating = (isTv ? s!.rating : m!.rating) ?? null;
  const meta = isTv
    ? [s!.years?.slice(0, 4), `${s!.seasons.length} season${s!.seasons.length === 1 ? "" : "s"}`, s!.genres[0], rating && `★ ${rating}`]
    : [m!.year, m!.runtime ? formatRuntime(m!.runtime) : null, m!.genres[0], rating && `★ ${rating}`];
  const target = isTv ? (s!.next ? { mediaType: "tv" as const, id: s!.id, season: s!.next.season, episode: s!.next.episode } : null) : { mediaType: "movie" as const, id: m!.id };
  const d = (isTv ? s : m)!;
  return (
    <TitleHero eyebrow="From your To watch" title={d.title} meta={meta} overview={d.overview} backdropPath={d.backdropPath} layout="home">
      {target && (
        <PlayButton target={target} className={heroAction.play}>
          <PlayGlyph />
          Play
        </PlayButton>
      )}
      <ListToggles mediaType={first.mediaType} id={first.id} only={["watched"]} labelled />
      <Link to={`/${first.mediaType}/${first.id}`} className={heroAction.toggle}>
        More info
      </Link>
    </TitleHero>
  );
}
