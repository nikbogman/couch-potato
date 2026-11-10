import type { ReactNode } from "react";
import { backdropUrl } from "../lib/api";
import styles from "./TitleHero.module.css";

/** Class names for what goes in the hero's action row: the primary button and the muted text beside it. */
export const heroAction = { play: styles.play, toggle: styles.toggle, aside: styles.aside };

/**
 * The top of a title page: backdrop fading into the page, title, meta line, overview and an action row.
 * `compact` (series) is shorter, so the episode list starts on the first screen.
 */
export function TitleHero(p: { eyebrow?: string; title: string; meta: string; overview: string; backdropPath: string | null; compact?: boolean; children: ReactNode }) {
  return (
    <section className={`${styles.hero} ${p.compact ? styles.compact : ""}`}>
      {p.backdropPath && <img className={styles.backdrop} src={backdropUrl(p.backdropPath)} alt="" width={1280} height={720} fetchPriority="high" />}
      <div className={styles.scrim} />
      <div className={styles.info}>
        {p.eyebrow && <p className={styles.eyebrow}>{p.eyebrow}</p>}
        <h1 className={styles.title}>{p.title}</h1>
        {p.meta && <p className={styles.meta}>{p.meta}</p>}
        {p.overview && <p className={styles.overview}>{p.overview}</p>}
        <div className={styles.actions}>{p.children}</div>
      </div>
    </section>
  );
}
