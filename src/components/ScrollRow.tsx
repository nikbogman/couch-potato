import { useEffect, useRef, useState, type ReactNode } from "react";
import { pageTarget } from "../navigation/scroll";
import styles from "./ScrollRow.module.css";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const Chevron = ({ back }: { back?: boolean }) => (
  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/**
 * A horizontally scrolling row of cards for mouse users (the pad and keyboard use spatial focus and scroll it themselves):
 * chevron buttons on both ends page by about a visible width, appear while the pointer is over the row, and hide at the start/end;
 * a fade at an end that has more behind it hints there is more. The native scrollbar stays hidden; wheel (shift+wheel, trackpad swipe) works as usual.
 * The buttons stay out of the focus order and never take focus from a card.
 */
export function ScrollRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft < 2;
      const end = el.scrollLeft > el.scrollWidth - el.clientWidth - 2;
      setEdge((p) => (p.start === start && p.end === end ? p : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update); // the viewport changing size
    const mo = new MutationObserver(update); // cards arriving or leaving
    ro.observe(el);
    mo.observe(el, { childList: true });
    return () => (el.removeEventListener("scroll", update), ro.disconnect(), mo.disconnect());
  }, []);
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const offsets = [...el.children].map((c) => (c as HTMLElement).offsetLeft);
    const left = pageTarget(dir, { scrollLeft: el.scrollLeft, view: el.clientWidth, max: el.scrollWidth - el.clientWidth, offsets });
    el.scrollTo({ left, behavior: reducedMotion() ? "instant" : "smooth" });
  };
  const hold = (e: React.MouseEvent) => e.preventDefault(); // a click must not move focus onto the button: arrow keys would then start from it
  return (
    <div className={styles.row} data-start={edge.start} data-end={edge.end}>
      <button type="button" tabIndex={-1} className={`${styles.arrow} ${styles.prev}`} aria-label="Scroll back" disabled={edge.start} onMouseDown={hold} onClick={() => page(-1)}>
        <Chevron back />
      </button>
      <ul ref={track} data-cards data-track className={`${styles.track} ${className}`}>
        {children}
      </ul>
      <button type="button" tabIndex={-1} className={`${styles.arrow} ${styles.next}`} aria-label="Scroll forward" disabled={edge.end} onMouseDown={hold} onClick={() => page(1)}>
        <Chevron />
      </button>
    </div>
  );
}
