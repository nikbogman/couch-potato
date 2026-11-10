import { useState } from "react";
import { Link } from "react-router";
import { backdropUrl } from "../lib/api";
import { PAUSE_ICON, PLAY_ICON } from "../components/NowPlayingBar";
import { ADAPTERS, mmss } from "../player/adapters";
import { useRemote } from "../remote/RemoteContext";
import { PageMessage } from "../components/Status";
import styles from "./NowPlaying.module.css";

const SKIP = 30;
const icon = { "aria-hidden": true, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Phone only: full playback controls for what the TV is playing. */
export function NowPlaying() {
  const remote = useRemote();
  const np = remote?.nowPlaying;
  const [drag, setDrag] = useState<number | null>(null); // scrubber value while the thumb is down; seeks on release
  if (!remote) return null;
  if (!np)
    return (
      <div className={styles.page}>
        <PageMessage>Nothing is playing on the TV.</PageMessage>
        <Link to="/remote" className={styles.back}>
          Back to browsing
        </Link>
      </div>
    );
  const { command } = remote;
  const shown = drag ?? np.position;
  const commit = () => {
    if (drag !== null) command({ cmd: "seekTo", time: drag });
    setDrag(null);
  };
  const skip = (delta: number, label: string, path: string) => (
    <button type="button" className={styles.skip} aria-label={label} onClick={() => command({ cmd: "seekBy", delta })}>
      <svg {...icon} width="40" height="40" strokeWidth={1.8}>
        <path d={path} />
      </svg>
      <span aria-hidden="true">{SKIP}</span>
    </button>
  );
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/remote" className={styles.close} aria-label="Close now playing">
          <svg {...icon} width="24" height="24" strokeWidth={2.2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Link>
        <span className={styles.live}>Playing on TV</span>
        <span className={styles.close} aria-hidden="true" />
      </header>

      {np.art ? <img className={styles.art} src={backdropUrl(np.art, "w780")} alt="" /> : <div className={styles.art} aria-hidden="true" />}
      <div>
        <h1 className={styles.title}>{np.title}</h1>
        {np.episode && <p className={styles.meta}>{np.episode}</p>}
      </div>

      <div className={styles.scrub}>
        <label htmlFor="scrub" className="sr-only">
          Position
        </label>
        <input
          id="scrub"
          className={styles.range}
          type="range"
          min={0}
          max={Math.max(np.duration, shown, 1)}
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

      <div className={styles.transport}>
        {skip(-SKIP, "Back 30 seconds", "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4")}
        <button type="button" className={styles.play} aria-label={np.playing ? "Pause" : "Play"} onClick={() => command({ cmd: np.playing ? "pause" : "play" })}>
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            {np.playing ? PAUSE_ICON : PLAY_ICON}
          </svg>
        </button>
        {skip(SKIP, "Forward 30 seconds", "M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4")}
      </div>

      <div className={styles.volume}>
        <button type="button" className={styles.round} aria-label={np.muted ? "Unmute" : "Mute"} aria-pressed={np.muted} onClick={() => command({ cmd: "setMuted", muted: !np.muted })}>
          <svg {...icon} width="20" height="20">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {np.muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 9a4 4 0 0 1 0 6" />}
          </svg>
        </button>
        <label htmlFor="vol" className="sr-only">
          Volume
        </label>
        <input
          id="vol"
          className={`${styles.range} ${styles.vol}`}
          type="range"
          min={0}
          max={100}
          value={Math.round(np.volume * 100)}
          onChange={(e) => command({ cmd: "setVolume", volume: Number(e.target.value) / 100 })}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={!np.canNext} onClick={() => command({ cmd: "nextEpisode" })}>
          <svg {...icon} width="20" height="20">
            <path d="M5 5l9 7-9 7zM18 5v14" />
          </svg>
          Next episode
        </button>
        <button type="button" className={styles.action} onClick={() => command({ cmd: "switchPlayer" })}>
          <svg {...icon} width="20" height="20">
            <path d="M4 7h13l-3-3M20 17H7l3 3" />
          </svg>
          <span className="sr-only">Switch player, now </span>
          Player {ADAPTERS[np.player].label}
        </button>
        <button type="button" className={styles.action} onClick={() => command({ cmd: "stop" })}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stop
        </button>
      </div>
    </div>
  );
}
