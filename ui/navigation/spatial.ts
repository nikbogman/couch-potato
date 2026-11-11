import { revealX, rowScrollTop } from "./scroll";

// Spatial focus navigation: pure choice of the next element (tested with fake rects), plus the DOM glue around it.
export type Rect = { left: number; top: number; right: number; bottom: number };
export type Dir = "up" | "down" | "left" | "right";

const horizontal = (d: Dir) => d === "left" || d === "right";
const sign = (d: Dir) => (d === "right" || d === "down" ? 1 : -1);
/** [start, end] along the axis of travel, and across it. */
const along = (r: Rect, d: Dir): [number, number] => (horizontal(d) ? [r.left, r.right] : [r.top, r.bottom]);
const across = (r: Rect, d: Dir): [number, number] => (horizontal(d) ? [r.top, r.bottom] : [r.left, r.right]);
const mid = ([a, b]: [number, number]) => (a + b) / 2;

/**
 * Index of the best candidate in direction `d` from `from`, or -1. A candidate must have its centre ahead of ours
 * (so same-row neighbours are never "down"); then the nearest wins, with heavy weight on staying aligned on the cross axis.
 * Overlapping elements (a button on a card) count as zero distance apart.
 */
export function pickNext(from: Rect, cands: Rect[], d: Dir): number {
  const [f0, f1] = along(from, d);
  const [fc0, fc1] = across(from, d);
  let best = -1;
  let bestScore = Infinity;
  cands.forEach((c, i) => {
    const [c0, c1] = along(c, d);
    const [cc0, cc1] = across(c, d);
    const ahead = (mid([c0, c1]) - mid([f0, f1])) * sign(d);
    if (ahead <= 0 || ahead < 0.25 * Math.min(f1 - f0, c1 - c0)) return;
    const gap = Math.max(0, sign(d) > 0 ? c0 - f1 : f0 - c1);
    const crossGap = Math.max(0, cc0 - fc1, fc0 - cc1);
    if (horizontal(d) && crossGap > 0) return; // sideways stays in its row: the end of a row is an end, not a jump into the next row
    const score = gap + 2 * crossGap + 0.5 * Math.abs(mid([cc0, cc1]) - mid([fc0, fc1]));
    if (score < bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

export type Jump = "home" | "end" | "pageUp" | "pageDown";

/**
 * Index of the target for Home/End/PageUp/PageDown, or -1. Home/End: first/last item of the focused one's row (or of the whole list when it
 * is alone in its row, like episodes). Page keys: the item about a `page` away vertically, keeping the column.
 */
export function pickJump(from: Rect, cands: Rect[], kind: Jump, page = 800): number {
  const centre = (r: Rect, axis: "x" | "y") => (axis === "x" ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2);
  const argmin = (idx: number[], score: (i: number) => number) => idx.reduce((b, i) => (b < 0 || score(i) < score(b) ? i : b), -1);
  const all = cands.map((_, i) => i);
  if (kind === "home" || kind === "end") {
    const row = all.filter((i) => cands[i]!.top < from.bottom && cands[i]!.bottom > from.top);
    const pool = row.length > 1 ? row : all;
    const axis = row.length > 1 ? "x" : "y";
    return argmin(pool, (i) => (kind === "home" ? 1 : -1) * centre(cands[i]!, axis));
  }
  const dir = kind === "pageDown" ? 1 : -1;
  const target = centre(from, "y") + dir * page;
  const ahead = all.filter((i) => (centre(cands[i]!, "y") - centre(from, "y")) * dir > 1);
  return argmin(ahead, (i) => Math.abs(centre(cands[i]!, "y") - target) + 0.5 * Math.abs(centre(cands[i]!, "x") - centre(from, "x")));
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
const TEXT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/** Text fields keep left/right for the caret. */
export const isTextEntry = (el: Element | null) =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)) || (el instanceof HTMLElement && el.isContentEditable);

/** Roving-tabindex widgets (season tabs, radio segments) expose only their current member. */
function focusables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex >= 0 && !el.closest("[inert]") && el.checkVisibility({ visibilityProperty: true }) && el.getClientRects().length > 0,
  );
}

/** The mouse moving onto something focusable moves focus there, so the mouse and the pad share one highlight. Never steals from a field being typed in. */
export function focusUnderPointer(target: EventTarget | null) {
  const el = target instanceof Element ? target.closest<HTMLElement>(FOCUSABLE) : null;
  if (!el || el.tabIndex < 0 || el === document.activeElement || isTextEntry(document.activeElement)) return;
  el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Focus a page's starting element and move the page as little as possible: not at all when it is already on screen,
 * else just enough to show it (unlike browsing, which also brings the next item into view).
 */
export function placeFocus(el: HTMLElement) {
  el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  const r = el.getBoundingClientRect();
  const top = document.querySelector<HTMLElement>("[data-app-header]")?.offsetHeight ?? 0;
  const by = r.bottom > innerHeight ? r.bottom - innerHeight + PLACE_GAP : r.top < top ? r.top - top - PLACE_GAP : 0;
  if (by) scrollBy({ top: by, behavior: "instant" });
}
const PLACE_GAP = 24;

/**
 * Focus without letting the browser pick the scroll, then place it ourselves (maths in scroll.ts).
 * A card in a [data-track] row: the row scrolls sideways to keep a peek of its neighbours, and the page scrolls so the row's heading sits near the top
 * (the first row goes to the very top). Anything else (grid, episode list, header) scrolls the minimum, leaving the room its CSS `scroll-margin` asks for.
 * `smooth` is skipped for reduced motion and for the first placement on a page.
 * `focusVisible` makes the ring show even after a mouse click, when browsers would otherwise hide it for script focus (pad users).
 */
export function focusAndReveal(el: HTMLElement, smooth = true) {
  el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  const behavior = smooth && !reducedMotion() ? "smooth" : "instant";
  const track = el.closest<HTMLElement>("[data-track]");
  const item = track && [...track.children].find((c) => c.contains(el));
  if (!track || !item) return el.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
  const edge = track.getBoundingClientRect().left;
  const box = item.getBoundingClientRect();
  track.scrollTo({
    left: revealX({ left: box.left - edge, right: box.right - edge, view: track.clientWidth, scrollLeft: track.scrollLeft, max: track.scrollWidth - track.clientWidth }),
    behavior,
  });
  const section = track.closest("section") ?? track;
  window.scrollTo({
    top: rowScrollTop({
      rowTop: section.getBoundingClientRect().top + scrollY,
      focusBottom: box.bottom + scrollY,
      first: section === document.querySelector("main section"),
      view: innerHeight,
      max: document.documentElement.scrollHeight - innerHeight,
      header: document.querySelector<HTMLElement>("[data-app-header]")?.offsetHeight ?? 0,
    }),
    behavior,
  });
}

/** Home/End/PageUp/PageDown. True if focus moved. */
export function jumpFocus(kind: Jump, root: ParentNode = document): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return false;
  const all = focusables(root);
  const to = all[pickJump(active.getBoundingClientRect(), all.map((el) => el.getBoundingClientRect()), kind, innerHeight * 0.8)];
  if (to && to !== active) focusAndReveal(to, false); // long way: a smooth scroll would crawl
  return !!to;
}

/** Move focus one step. With nothing focused it places focus instead. True if focus moved. */
export function moveFocus(d: Dir, root: ParentNode = document): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return restoreFocus(false);
  const all = focusables(root);
  // `active` may be among the candidates; its own centre is never ahead of itself, so it is skipped.
  const to = all[pickNext(active.getBoundingClientRect(), all.map((el) => el.getBoundingClientRect()), d)];
  if (to) focusAndReveal(to);
  return !!to;
}

/**
 * If focus is lost (on the body or on something gone), put it on the page's primary element:
 * the first focusable in <main> (a page with a better primary element, like the movie page's Play button, focuses it itself). `strict` stays out of the header.
 */
export function restoreFocus(strict: boolean): boolean {
  const a = document.activeElement;
  if (a && a !== document.body && a.isConnected) return false;
  const main = document.querySelector("main");
  const to = (main && focusables(main)[0]) ?? (strict ? undefined : focusables(document)[0]);
  if (to) focusAndReveal(to);
  return !!to;
}

/** Fire an arrow key at the focused element, so widgets with their own arrow handling (tabs, radio groups) take part. */
export function pressArrow(d: Dir) {
  const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[d];
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}
