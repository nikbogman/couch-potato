import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { fetchMovie, fetchSeries } from "../lib/api";
import { useList } from "../lib/collection";
import { formatRuntime } from "../lib/format";
import { ListToggles } from "./ListToggles";
import { PlayButton } from "./PlayButton";
import { heroAction, TitleHero } from "./TitleHero";

/** TV Home's top (designs: TV · Home): the newest title in To watch, with Play, the list toggles and More info. Nothing while loading or when To watch is empty. */
export function UpNextHero() {
  const first = useList("to_watch").data?.pages[0]?.items[0];
  const isTv = first?.mediaType === "tv";
  const id = String(first?.id ?? "");
  const movie = useQuery({ queryKey: ["movie", id], queryFn: () => fetchMovie(id), enabled: !!first && !isTv });
  const series = useQuery({ queryKey: ["progress", "tv", id], queryFn: () => fetchSeries(id), enabled: !!first && isTv, gcTime: 0 });
  if (!first) return null;
  const m = movie.data;
  const s = series.data;
  const d = isTv ? s : m;
  if (!d) return null;
  const meta = isTv
    ? [s!.years, `${s!.seasons.length} season${s!.seasons.length === 1 ? "" : "s"}`, s!.genres.slice(0, 2).join(", ")]
    : [m!.year, m!.runtime && formatRuntime(m!.runtime), m!.genres.slice(0, 2).join(", ")];
  const target = isTv ? (s!.next ? { mediaType: "tv" as const, id: s!.id, ...s!.next } : null) : { mediaType: "movie" as const, id: m!.id };
  return (
    <TitleHero eyebrow="From your To watch" title={d.title} meta={meta.filter(Boolean).join(" · ")} overview={d.overview} backdropPath={d.backdropPath} compact>
      {target && (
        <PlayButton target={target} className={heroAction.play}>
          ▶ Play
        </PlayButton>
      )}
      <ListToggles mediaType={first.mediaType} id={first.id} />
      <Link to={`/${first.mediaType}/${first.id}`} className={heroAction.toggle}>
        More info
      </Link>
    </TitleHero>
  );
}
