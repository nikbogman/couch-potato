import { Link, useLocation } from "react-router";
import { backdropUrl } from "../lib/api";
import { mmss } from "../player/adapters";
import { useRemote } from "../remote/RemoteContext";
import styles from "./NowPlayingBar.module.css";

export const PLAY_ICON = <path d="M7 4.5v15l12-7.5z" />;
export const PAUSE_ICON = (
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>
);

/** Phone only: a persistent bar while the TV plays. Tapping it opens the full controls; the button toggles play/pause. */
export function NowPlayingBar() {
  const remote = useRemote();
  const { pathname } = useLocation();
  const np = remote?.nowPlaying;
  if (!remote || !np || pathname === "/remote/now-playing") return null;
  const label = [np.episode, `${mmss(np.position)} / ${mmss(np.duration)}`].filter(Boolean).join(" · ");
  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <Link to="/remote/now-playing" className={styles.open} aria-label={`Now playing on TV: ${np.title} ${np.episode ?? ""}. Open controls`}>
          {np.art ? <img className={styles.art} src={backdropUrl(np.art, "w300")} alt="" /> : <span className={styles.art} aria-hidden="true" />}
          <span className={styles.text}>
            <span className={styles.live}>On TV</span>
            <span className={styles.title}>{np.title}</span>
            <span className={styles.meta}>{label}</span>
          </span>
        </Link>
        <button type="button" className={styles.toggle} aria-label={np.playing ? "Pause" : "Play"} onClick={() => remote.command({ cmd: np.playing ? "pause" : "play" })}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            {np.playing ? PAUSE_ICON : PLAY_ICON}
          </svg>
        </button>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${np.duration > 0 ? Math.min(100, (np.position / np.duration) * 100) : 0}%` }} />
      </div>
    </div>
  );
}
