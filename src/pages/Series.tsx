import { useEffect, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router";
import { backdropUrl, fetchSeason, fetchSeries, type EpisodeSummary, type SeriesDetails } from "../lib/api";
import { PadHints } from "../components/PadHints";
import { PLAY_ON_TV, NoTvNote, PlayButton } from "../components/PlayButton";
import { ListToggles } from "../components/ListToggles";
import { LoadError, PageMessage, Status } from "../components/Status";
import { heroAction, TitleHero } from "../components/TitleHero";
import { usePad } from "../navigation/gamepadInput";
import { placeFocus } from "../navigation/spatial";
import { formatRuntime, timeLeft } from "../lib/format";
import { useRemote } from "../remote/RemoteContext";
import styles from "./Series.module.css";

export function Series() {
  const { id = "" } = useParams();
  // gcTime 0: progress changes while you watch, so never paint a cached copy on the way back.
  const { data: s, isError, error } = useQuery({ queryKey: ["progress", "tv", id], queryFn: () => fetchSeries(id), gcTime: 0 });
  if (isError) return <PageMessage>{error.message}.</PageMessage>;
  if (!s) return <PageMessage>Loading…</PageMessage>;
  return <SeriesPage s={s} />;
}

function SeriesPage({ s }: { s: SeriesDetails }) {
  const [params, setParams] = useSearchParams();
  const { next } = s;
  const remote = useRemote();
  const asked = Number(params.get("season"));
  const season = s.seasons.some((x) => x.season === asked) ? asked : (next?.season ?? s.seasons[0]?.season);
  const meta = [s.years, `${s.seasons.length} season${s.seasons.length === 1 ? "" : "s"}`, s.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
  const resume = next?.progress;
  return (
    <div className={styles.page}>
      <TitleHero title={s.title} meta={meta} overview={s.overview} backdropPath={s.backdropPath} compact>
        {next && (
          <PlayButton target={{ mediaType: "tv", id: s.id, season: next.season, episode: next.episode }} remoteLabel={PLAY_ON_TV} className={heroAction.play}>
            {resume ? "▶ Resume" : "▶ Play"}
          </PlayButton>
        )}
        <NoTvNote className={heroAction.aside} />
        <ListToggles mediaType="tv" id={s.id} />
        {next && (
          <span className={heroAction.aside}>
            S{next.season} E{next.episode}
            {resume && ` · ${timeLeft(resume.position, resume.duration)}`}
          </span>
        )}
      </TitleHero>
      {season !== undefined && (
        <Picker s={s} season={season} select={(n) => setParams({ season: String(n) }, { replace: true })} />
      )}
      {!remote && (
        <PadHints
          hints={[
            { glyph: "A", label: "Play" },
            { glyph: "B", label: "Back" },
            { glyph: "LB RB", label: "Season" },
          ]}
        />
      )}
    </div>
  );
}

/** Season tabs and the episode list. On first load it focuses the next episode (or the season's first), so Enter plays it. */
function Picker({ s, season, select }: { s: SeriesDetails; season: number; select: (n: number) => void }) {
  const tabs = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const remote = useRemote();
  const placed = useRef(false);
  // The previous season stays on screen while the next one loads: no "Loading…" flash, and the focused row isn't torn out.
  const { data: episodes, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["progress", "tv", String(s.id), "season", season],
    queryFn: () => fetchSeason(String(s.id), season),
    gcTime: 0,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (placed.current || !episodes || isPlaceholderData || remote) return; // a touch screen has no focus to place
    placed.current = true;
    const want = s.next && s.next.season === season ? list.current?.querySelector<HTMLElement>(`[data-episode="${s.next.episode}"]`) : null;
    const first = want ?? list.current?.querySelector<HTMLElement>("a");
    if (first) placeFocus(first);
  }, [episodes, isPlaceholderData, s.next, season, remote]);

  // LB / RB step through the seasons, then land on the new season's next (or first) episode once it loads.
  usePad((a) => {
    const to = s.seasons[s.seasons.findIndex((x) => x.season === season) + (a === "rb" ? 1 : a === "lb" ? -1 : 0)];
    if (!to || remote || (a !== "lb" && a !== "rb")) return;
    placed.current = false;
    select(to.season);
  });

  // Arrow keys move along the tabs and select as they go.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = s.seasons[s.seasons.findIndex((x) => x.season === season) + step];
    if (!step || !to) return;
    e.preventDefault();
    select(to.season);
    tabs.current?.querySelectorAll<HTMLElement>('[role="tab"]')[s.seasons.indexOf(to)]?.focus();
  };

  return (
    <section className={styles.picker} aria-label="Episodes">
      <div ref={tabs} role="tablist" aria-label="Seasons" className={styles.tabs} onKeyDown={onKeyDown}>
        {s.seasons.map((x) => (
          <button
            key={x.season}
            type="button"
            role="tab"
            aria-selected={x.season === season}
            tabIndex={x.season === season ? 0 : -1}
            className={`${styles.tab} ${x.season === season ? styles.selected : ""}`}
            onClick={() => select(x.season)}
          >
            Season {x.season}
          </button>
        ))}
      </div>
      {isError ? (
        <LoadError what="episodes" retry={() => refetch()} />
      ) : !episodes ? (
        <Status>Loading…</Status>
      ) : !episodes.length ? (
        <Status>No episodes have aired yet.</Status>
      ) : (
        <ul ref={list} className={styles.list}>
          {episodes.map((e) => (
            <li key={e.episode}>
              <EpisodeRow id={s.id} season={season} e={e} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EpisodeRow({ id, season, e }: { id: number; season: number; e: EpisodeSummary }) {
  const remote = useRemote();
  const p = e.progress;
  return (
    <PlayButton target={{ mediaType: "tv", id, season, episode: e.episode }} className={styles.row} data-episode={e.episode}>
      <div className={styles.still}>
        {e.stillPath && <img src={backdropUrl(e.stillPath, "w300")} alt="" width={300} height={169} loading="lazy" />}
        {p && !p.finished && (
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${Math.min(100, (p.position / p.duration) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className={styles.text}>
        <div className={styles.head}>
          <span className={styles.name}>
            {e.episode}. {e.name}
          </span>
          {e.runtime && <span className={styles.runtime}>{formatRuntime(e.runtime)}</span>}
        </div>
        <p className={styles.blurb}>{e.overview}</p>
      </div>
      {p?.finished && (
        <span className={styles.check} role="img" aria-label="Watched">
          ✓
        </span>
      )}
      {remote && (
        <span className={styles.cast} role="img" aria-label="Play on TV">
          ▶
        </span>
      )}
    </PlayButton>
  );
}
