import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { backdropUrl } from "../lib/api";
import { PAUSE_ICON, PLAY_ICON } from "../components/NowPlayingBar";
import { TvStatus } from "../components/TvStatus";
import { ADAPTERS, mmss } from "../player/adapters";
import { useRemote } from "../remote/RemoteContext";
import styles from "./NowPlaying.module.css";

const SKIP = 10;
const icon = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Phone Remote tab (designs: Phone · Remote): still, title, progress with times, back 10 / play / forward 10, then four text buttons. */
export function NowPlaying() {
  const remote = useRemote();
  const np = remote?.nowPlaying;
  const [drag, setDrag] = useState<number | null>(null); // scrubber value while the thumb is down; seeks on release
  if (!remote) return null;
  const head = (
    <div className={styles.head}>
      <h1 className={styles.h1}>Remote</h1>
      <TvStatus />
    </div>
  );
  if (!np)
    return (
      <div className={styles.page}>
        {head}
        <p className={styles.idle}>
          Nothing is playing on the TV. <Link to="/remote">Pick something to watch</Link>
        </p>
      </div>
    );
  const { command } = remote;
  const shown = drag ?? np.position;
  const max = Math.max(np.duration, shown, 1);
  const commit = () => {
    if (drag !== null) command({ cmd: "seekTo", time: drag });
    setDrag(null);
  };
  const skip = (delta: number, label: string, path: string) => (
    <button type="button" className={styles.skip} aria-label={label} onClick={() => command({ cmd: "seekBy", delta })}>
      <svg {...icon} width="26" height="26">
        <path d={path} />
      </svg>
    </button>
  );
  return (
    <div className={styles.page}>
      {head}
      <section className={styles.now} aria-label="Now playing">
        {np.art ? <img className={styles.art} src={backdropUrl(np.art, "w780")} alt="" /> : <div className={styles.art} aria-hidden="true" />}
        <div className={styles.names}>
          <span className={styles.meta}>{np.episode ? `${np.title} · ${np.episode.replace(" ", " · ")}` : "Movie"}</span>
          <h2 className={styles.title}>{np.episode ? (np.episodeName ?? np.episode) : np.title}</h2>
        </div>
        <div className={styles.scrub}>
          <label htmlFor="scrub" className="sr-only">
            Position
          </label>
          <input
            id="scrub"
            className={styles.range}
            style={{ "--p": `${(shown / max) * 100}%` } as CSSProperties}
            type="range"
            min={0}
            max={max}
            step={1}
            value={shown}
            disabled={np.duration <= 0}
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
          />
          <div className={styles.times}>
            <span>{mmss(shown)}</span>
            <span>−{mmss(Math.max(0, np.duration - shown))}</span>
          </div>
        </div>
      </section>

      <div className={styles.transport}>
        {skip(-SKIP, "Back 10 seconds", "M4 12a8 8 0 1 0 3-6.2M4 4v4h4")}
        <button type="button" className={styles.play} aria-label={np.playing ? "Pause" : "Play"} onClick={() => command({ cmd: np.playing ? "pause" : "play" })}>
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            {np.playing ? PAUSE_ICON : PLAY_ICON}
          </svg>
        </button>
        {skip(SKIP, "Forward 10 seconds", "M20 12a8 8 0 1 1-3-6.2M20 4v4h-4")}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => command({ cmd: "switchPlayer" })}>
          <span className="sr-only">Switch player, now Player {ADAPTERS[np.player].label}. </span>
          <span aria-hidden="true">Switch player · {ADAPTERS[np.player].label}</span>
        </button>
        <button type="button" className={styles.action} disabled={!np.canNext} onClick={() => command({ cmd: "nextEpisode" })}>
          Next episode
        </button>
        <button type="button" className={styles.action} aria-pressed={np.fullscreen} onClick={() => command({ cmd: "fullscreen" })}>
          {np.fullscreen ? "Exit full screen" : "Full screen"}
        </button>
        <button type="button" className={styles.action} onClick={() => command({ cmd: "stop" })}>
          Stop
        </button>
      </div>
    </div>
  );
}
