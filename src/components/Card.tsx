import { Link } from "react-router";
import { backdropUrl, posterUrl, type SearchResult } from "../lib/api";
import { timeLeft } from "../lib/format";
import { useBase } from "../remote/RemoteContext";
import styles from "./Card.module.css";

type Resume = { position: number; duration: number; backdropPath: string | null; season?: number; episode?: number };

/** "32 min left" for a started movie or episode, "Next episode" for a series' unstarted one; series get "S2 E4 · " in front. */
function resumeLine(p: Resume): string {
  const left = p.duration > 0 ? timeLeft(p.position, p.duration) : "Next episode";
  return p.season === undefined ? left : `S${p.season} E${p.episode} · ${left}`;
}

/**
 * Poster card linking to a title page. `badge` adds the Movie/Series tag (needed where types are mixed).
 * `progress` switches to the landscape Continue watching variant: backdrop, bottom progress bar (once started) and time left;
 * `onRemove` adds a button for dropping it from that row: it is out of the arrow-key order (so Up/Right never land on it);
 * from the keyboard the focused card is removed with Delete (the pad's Y fires the same key).
 */
export function Card({
  r,
  badge = false,
  progress,
  onRemove,
}: {
  r: SearchResult;
  badge?: boolean;
  progress?: Resume;
  onRemove?: () => void;
}) {
  const base = useBase();
  const image = progress ? progress.backdropPath && backdropUrl(progress.backdropPath, "w780") : r.posterPath && posterUrl(r.posterPath);
  return (
    <div className={styles.wrap}>
      <Link
        to={`${base}/${r.mediaType}/${r.id}`}
        className={styles.card}
        aria-keyshortcuts={onRemove ? "Delete" : undefined}
        onKeyDown={onRemove && ((e) => e.key === "Delete" && (e.preventDefault(), onRemove()))}
      >
        <div className={`${styles.poster} ${progress ? styles.landscape : ""}`}>
          {image ? <img src={image} alt="" width={progress ? 780 : 342} height={progress ? 439 : 513} loading="lazy" /> : <span className={styles.fallback}>{r.title}</span>}
          {badge && <span className={styles.badge}>{r.mediaType === "movie" ? "Movie" : "Series"}</span>}
          {progress && progress.duration > 0 && (
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${Math.min(100, (progress.position / progress.duration) * 100)}%` }} />
            </div>
          )}
        </div>
        <div className={styles.title}>{r.title}</div>
        {progress ? (
          <div className={styles.meta}>{resumeLine(progress)}</div>
        ) : (
          r.year && <div className={styles.meta}>{r.year}</div>
        )}
      </Link>
      {onRemove && (
        <button type="button" tabIndex={-1} className={styles.remove} onClick={onRemove} aria-label={`Remove ${r.title} from Continue watching`}>
          ✕
        </button>
      )}
    </div>
  );
}
