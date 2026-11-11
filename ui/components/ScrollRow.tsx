import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ScrollRow.module.css";

const Chevron = ({ back }: { back?: boolean }) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/**
 * A horizontally scrolling row of cards. The pad and keyboard scroll it by moving focus; touch by swiping.
 * A mouse gets round arrows at both ends (only while the mouse is the input in use: html[data-mouse]), plus shift+wheel and trackpad swipes.
 * `wheel`: the plain wheel scrolls the row sideways too (for a row with nothing under it); at either end it scrolls the page as usual.
 */
export function ScrollRow({ children, className = "", wheel = false }: { children: ReactNode; className?: string; wheel?: boolean }) {
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
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // already sideways
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return; // at the end: let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    if (wheel) el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(update);
    const mo = new MutationObserver(update);
    ro.observe(el);
    mo.observe(el, { childList: true });
    return () => (el.removeEventListener("scroll", update), el.removeEventListener("wheel", onWheel), ro.disconnect(), mo.disconnect());
  }, [wheel]);
  // About a screen along, keeping the safe margin so the next card isn't cut in half at the edge.
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const hold = (e: React.MouseEvent) => e.preventDefault(); // clicking an arrow must not take focus off the card
  return (
    <div className={styles.row}>
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
