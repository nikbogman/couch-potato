import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMovie, fetchNextEpisode, fetchProgress, fetchSeason, fetchSeries } from "../lib/api";
import { usePhoneConnected } from "../remote/TvClient";
import { type Target } from "../../shared/types";
import { createPlaybackState, createStateReporter } from "../player/playbackState";
import { type NowPlaying, type PlaybackCommand, type RemoteCommand } from "../../shared/playback";
import { isDirection, playbackFor } from "../navigation/gamepad";
import { usePad } from "../navigation/gamepadInput";
import { pressArrow } from "../navigation/spatial";
import { watchPath } from "../../shared/protocol";
import { tvBridge } from "../remote/tvBridge";
import { ADAPTERS, createSilenceWatch, cyclePlayer, DEFAULT_PLAYER, FALLBACK_AFTER_MS, mmss, PLAYER_IDS, playerFromParam, resumePoint } from "../player/adapters";
import { type PlayerId } from "../../shared/types";
import { usePlayerProgress } from "../player/usePlayerProgress";
import { setPreferredPlayer } from "../player/preferred";
import { PageMessage } from "../components/Status";
import styles from "./Player.module.css";

/** The toast for a phone command, or null for ones that show for themselves (switch, stop, next, volume). */
export function phoneToast(cmd: RemoteCommand, playingAfter: boolean): string | null {
  if (cmd.cmd === "play" || cmd.cmd === "pause" || cmd.cmd === "togglePlay") return playingAfter ? "Playing from phone" : "Paused from phone";
  if (cmd.cmd === "seekBy") return `${cmd.delta < 0 ? "Back" : "Forward"} ${Math.abs(cmd.delta)} s from phone`;
  if (cmd.cmd === "seekTo") return "Moved from phone";
  return null;
}

const STARTUP_MS = 15_000; // how long after a load the player gets its one "is it really playing?" check
const NOTE_MS = 6000; // how long the "switched" note stays (it fades over the same time)

/** Full-screen player (outside TvLayout) for a movie or one episode. Starts at our saved position and records progress from the player's messages. */
export function Player({ kind }: { kind: "movie" | "tv" }) {
  const { id = "", season = "", episode = "" } = useParams();
  if (kind === "tv" && !(Number.isInteger(+season) && +season >= 0 && Number.isInteger(+episode) && +episode >= 1))
    return <PageMessage>Episode not found.</PageMessage>;
  return <PlayerScreen id={id} season={kind === "tv" ? +season : undefined} episode={kind === "tv" ? +episode : undefined} />;
}

function PlayerScreen({ id, season, episode }: { id: string; season?: number; episode?: number }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const isTv = season !== undefined && episode !== undefined;
  const target: Target = isTv ? { mediaType: "tv", id, season, episode } : { mediaType: "movie", id };
  const { data: movie } = useQuery({ queryKey: ["movie", id], queryFn: () => fetchMovie(id), enabled: !isTv });
  const { data: series } = useQuery({ queryKey: ["progress", "tv", id], queryFn: () => fetchSeries(id), enabled: isTv, gcTime: 0 });
  const title = isTv ? series?.title : movie?.title;
  const art = (isTv ? series?.backdropPath : movie?.backdropPath) ?? null;
  const { data: next } = useQuery({
    queryKey: ["next", id, season, episode],
    queryFn: () => fetchNextEpisode({ mediaType: "tv", id, season: season!, episode: episode! }),
    enabled: isTv,
    staleTime: 5 * 60_000,
    retry: false,
  });
  // The episode's own name, for the band's title line (shared with the series page's cache).
  const { data: episodes } = useQuery({
    queryKey: ["progress", "tv", id, "season", season],
    queryFn: () => fetchSeason(id, season!),
    enabled: isTv,
    gcTime: 0,
  });
  const episodeName = episodes?.find((e) => e.episode === episode)?.name;
  const phone = usePhoneConnected();
  // Fullscreen (from the phone, or F on a keyboard): our band hides so the video fills the screen.
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const playback = useState(createPlaybackState)[0];
  // What the iframe was loaded with. It must not follow the URL: auto-next moves the URL and the video plays on.
  // `player` is the one the iframe holds; `?player=` in the URL mirrors it so reload and back keep the choice.
  const [loaded, setLoaded] = useState<{ target: Target; startAt: number; player: PlayerId } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const group = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const movedTo = useRef<string | null>(null); // the episode we moved the URL to ourselves

  // Read once per visit (not a query): refetching would change the iframe src and reload the video.
  const here = `${season}/${episode}`;
  useEffect(() => {
    if (movedTo.current === here) return; // our own URL update after the player went on to the next episode
    movedTo.current = null;
    let live = true;
    setLoaded(null);
    fetchProgress(target)
      .then((p) => (p && !p.finished ? p.position : 0))
      .catch(() => 0)
      .then((startAt) => live && setLoaded({ target, startAt, player: playerFromParam(params.get("player")) }));
    return () => {
      live = false;
    };
    // `target` is built from these two
  }, [id, here]);

  const silence = useRef<ReturnType<typeof createSilenceWatch> | null>(null);
  const player = loaded?.player ?? playerFromParam(params.get("player"));
  // The player last asked for, ahead of React's next render: phone presses that arrive close together each move on from the previous one.
  const wanted = useRef<PlayerId>(player);
  // True for a few seconds after a load: the player may report "play" while the browser has blocked its autoplay (a title cast from
  // the phone has no click behind it), so we ask its real status once and start it if it is paused.
  const starting = useRef(false);
  // What the phone is shown. Read through a ref so the reporter (made once) always sees the latest title, player and episode.
  const live = useRef({ target, title, art, canNext: !!next, player, full, episodeName });
  live.current = { target, title, art, canNext: !!next, player, full, episodeName };
  const reporter = useState(() =>
    createStateReporter(() => {
      const l = live.current;
      const state: NowPlaying = {
        target: l.target,
        title: (l.title ?? "").slice(0, 200),
        episode: l.target.mediaType === "tv" ? `S${l.target.season} E${l.target.episode}` : null,
        art: l.art,
        ...playback.get(),
        player: l.player,
        canNext: l.canNext,
        fullscreen: l.full,
        episodeName: l.episodeName?.slice(0, 200) ?? null,
      };
      tvBridge.push(state);
    }),
  )[0];
  const { stalled, leave, now, source } = usePlayerProgress(loaded?.target ?? null, ADAPTERS[player], (e) => {
    silence.current?.heard(); // any valid event proves the player is alive
    playback.event(e);
    reporter.event(e.kind);
    if (starting.current) {
      if (e.kind === "ready") post({ cmd: "getStatus" });
      else if (e.kind === "status") {
        starting.current = false;
        if (e.paused) post({ cmd: "play" });
      }
    }
    if (isTv && e.kind === "episodechange" && e.season !== undefined && e.episode !== undefined && `${e.season}/${e.episode}` !== here) {
      movedTo.current = `${e.season}/${e.episode}`;
      navigate({ pathname: `/watch/tv/${id}/${e.season}/${e.episode}`, search }, { replace: true });
    }
  });
  /** Reload the same title in the other player, where this one is. The old tracker saves on its way out. Returns the start used. */
  const switchTo = (next: PlayerId): number | null => {
    if (!loaded || next === wanted.current) return null;
    wanted.current = next;
    const at = resumePoint(now(), loaded);
    setLoaded({ ...at, player: next });
    setParams(next === DEFAULT_PLAYER ? {} : { player: next }, { replace: true });
    setPreferredPlayer(next); // the next title starts here too
    return at.startAt;
  };
  // A fresh load starts from our start time, not playing; tell the phone about it, and about a new title, player or next episode.
  useEffect(() => {
    if (!loaded) return;
    wanted.current = loaded.player;
    playback.reset(loaded.startAt);
    starting.current = true;
    const h = setTimeout(() => (starting.current = false), STARTUP_MS);
    return () => clearTimeout(h);
  }, [loaded]);
  useEffect(() => {
    if (loaded) reporter.push();
  }, [loaded, title, art, next, here, full, episodeName]);
  const fallBack = useEffectEvent(() => {
    const at = switchTo("playertwo");
    if (at !== null) setNote(`Player 1 didn't respond, switched to player 2 at ${mmss(at)}`);
  });
  // playerone gets FALLBACK_AFTER_MS from load to say anything. Only playerone falls back, so this can't loop.
  useEffect(() => {
    if (loaded?.player !== "playerone") return;
    const w = (silence.current = createSilenceWatch(FALLBACK_AFTER_MS, () => fallBack()));
    return () => w.cancel();
  }, [loaded]);
  useEffect(() => {
    if (!note) return;
    const h = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(h);
  }, [note]);
  // After a switch by keyboard the checked segment takes the focus, as in any radio group.
  useEffect(() => {
    if (group.current?.contains(document.activeElement)) group.current.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [player]);

  const back = () => void leave().then(() => navigate(isTv ? `/tv/${id}` : `/movie/${id}`));

  // Phone commands. The iframe is the only thing that plays; everything else is this screen's own navigation.
  const post = (cmd: PlaybackCommand) => {
    const a = loaded && ADAPTERS[loaded.player];
    if (!a) return;
    // To the iframe (where the players document their command listener) and, if different, to the window its events
    // come from (a nested player frame). Commands are absolute, so whichever listens, both hearing it does no harm.
    const top = frame.current?.contentWindow;
    const events = source() as Window | null;
    const payload = a.command(cmd, { ...playback.get() });
    top?.postMessage(payload, "*");
    if (events && events !== top) events.postMessage(payload, "*");
  };
  const goNext = () => next && void leave().then(() => navigate({ pathname: watchPath({ mediaType: "tv", id, ...next }), search }));
  const toggleFull = () => {
    const on = !full;
    setFull(on);
    // Browsers usually allow this only after a press on the TV itself; the hidden band is the part that always works.
    if (on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  const run = useEffectEvent((cmd: RemoteCommand) => {
    if (cmd.cmd === "stop") back();
    else if (cmd.cmd === "fullscreen") toggleFull();
    else if (cmd.cmd === "switchPlayer") {
      setNote(null);
      switchTo(cyclePlayer(wanted.current));
    } else if (cmd.cmd === "nextEpisode") goNext();
    else if (loaded) {
      // Before the page has loaded nothing can take the command, so it must not look done on the phone either.
      starting.current = false; // a deliberate command settles what the viewer wants
      post(cmd); // before the local state moves: the adapter works from the position and play state as they were
      playback.command(cmd);
      reporter.push();
    }
  });
  const sync = useEffectEvent(() => {
    if (!loaded) return;
    post({ cmd: "getStatus" }); // the player's answer is a status event, which pushes state again
    reporter.push();
  });
  // A command from the phone gets a short toast, so the room sees it landed.
  const fromPhone = useEffectEvent((cmd: RemoteCommand) => {
    run(cmd);
    const said = phoneToast(cmd, playback.get().playing);
    if (said) setNote(said);
  });
  useEffect(() => tvBridge.attach({ run: (cmd) => fromPhone(cmd), sync }), []);

  // Controller. Gamepad data only reaches this page while it has focus, so after every command we take focus back from the iframe.
  const refocusParent = () => {
    if (document.activeElement === frame.current) frame.current?.blur();
    window.focus();
  };
  const inBar = () => !!bar.current?.contains(document.activeElement);
  usePad((a) => {
    const el = document.activeElement;
    if (inBar() && isDirection(a)) return pressArrow(a); // Menu put focus on the top bar: the d-pad drives it
    if (inBar() && a === "a" && el instanceof HTMLElement) return el.click();
    const c = playbackFor(a);
    if (c === "back") back();
    else if (c === "menu") {
      if (full) setFull(false); // Menu brings the band back
      else if (inBar() && el instanceof HTMLElement) el.blur();
      else group.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    } else if (c) {
      run(c);
      refocusParent();
    }
  });
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Backspace") back();
    else if ((e.key === "f" || e.key === "F") && !inBar()) toggleFull();
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const t = loaded?.target;
  return (
    <div className={styles.player}>
      <div ref={bar} data-bar className={styles.bar} hidden={full}>
        <div className={styles.lead}>
          <button type="button" className={styles.back} onClick={back} aria-label="Back to title">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className={styles.heading}>
            {isTv && (
              <span className={styles.eyebrow}>
                {title} · S{season} · E{episode}
              </span>
            )}
            <h1 className={styles.name}>{isTv ? (episodeName ?? `Episode ${episode}`) : title}</h1>
          </div>
        </div>
        <div className={styles.tools}>
          <div
            ref={group}
            className={styles.switch}
            role="radiogroup"
            aria-label="Player"
            onKeyDown={(e) => {
              if (!e.key.startsWith("Arrow")) return;
              e.preventDefault();
              switchTo(cyclePlayer(wanted.current, e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1));
            }}
          >
            {PLAYER_IDS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === player}
                tabIndex={p === player ? 0 : -1}
                className={p === player ? styles.active : ""}
                onClick={() => {
                  setNote(null);
                  switchTo(p);
                }}
              >
                Player {ADAPTERS[p].label}
              </button>
            ))}
          </div>
          {next && (
            <button type="button" className={styles.glass} onClick={goNext}>
              Next episode
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <span className={styles.glass} role="img" aria-label={phone ? "Phone connected" : "No phone connected"}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={phone ? "var(--ok)" : "var(--muted)"} strokeWidth="2" strokeLinecap="round">
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path d="M11 18h2" />
            </svg>
          </span>
        </div>
        {note && (
          <p className={styles.note} role="status">
            {note}
          </p>
        )}
        {stalled && (
          <p className={styles.banner} role="status">
            Progress isn&rsquo;t being saved
          </p>
        )}
      </div>
      {loaded && t ? (
        <iframe
          ref={frame}
          className={styles.frame}
          src={ADAPTERS[loaded.player].url(t, loaded.startAt)}
          title={title ?? "Player"}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={refocusParent}
        />
      ) : (
        <div className={styles.frame} />
      )}
    </div>
  );
}
