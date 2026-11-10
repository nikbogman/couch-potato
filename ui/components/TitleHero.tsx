import type { ReactNode } from "react";
import { backdropUrl } from "../lib/api";
import styles from "./TitleHero.module.css";

/** Class names for what goes in the hero's action row: the primary button, the 14%-white ones (`square`: icon-only) and muted text. */
export const heroAction = { play: styles.play, toggle: styles.toggle, square: `${styles.toggle} ${styles.square}`, aside: styles.aside };

/** The filled play glyph on primary buttons (designs). */
export const PlayGlyph = ({ size = 24 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4l13 8-13 8z" />
  </svg>
);

/**
 * The top of a title page: backdrop, eyebrow, title, meta (separated by dots), overview and an action row.
 * `layout`: "page" fills the screen (movie), "series" leaves room for the episode row below, "home" is TV Home's hero.
 */
export function TitleHero(p: { eyebrow?: string; title: string; meta: (string | null | false | undefined)[]; overview: string; backdropPath: string | null; layout?: "page" | "series" | "home"; children: ReactNode }) {
  const meta = p.meta.filter((m): m is string => !!m);
  const layout = p.layout ?? "page";
  return (
    <section className={`${styles.hero} ${layout === "home" ? styles.compact : layout === "series" ? styles.series : ""}`}>
      {p.backdropPath && <img className={styles.backdrop} src={backdropUrl(p.backdropPath)} alt="" width={1280} height={720} fetchPriority="high" />}
      <div className={styles.scrim} />
      <div className={styles.info}>
        {p.eyebrow && <p className={styles.eyebrow}>{p.eyebrow}</p>}
        <h1 className={styles.title}>{p.title}</h1>
        {meta.length > 0 && (
          <p className={styles.meta}>
            {meta.map((m, i) => (
              <span key={i} className={styles.metaItem}>
                {i > 0 && <span aria-hidden="true">·</span>}
                {m}
              </span>
            ))}
          </p>
        )}
        {p.overview && <p className={styles.overview}>{p.overview}</p>}
        <div className={styles.actions}>{p.children}</div>
      </div>
    </section>
  );
}
