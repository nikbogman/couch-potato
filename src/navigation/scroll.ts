// Scroll-target maths for browsing, kept free of the DOM so it can be tested: where the page and a row should end up when focus moves.
const SAFE = 96; // --safe-x: the side margin rows are laid out with
const PEEK = 100; // how much of the neighbouring card stays visible when a row scrolls to follow focus
const GAP = 24; // room between the pinned header and a focused row's heading
const BOTTOM = 48; // minimum room under the focused card (its lift and halo reach about 30px past the item)

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/**
 * Page scrollTop (document coordinates in, document coordinates out) that shows the focused row with its heading just below the
 * pinned header (`header` = its height), so no card is left half-hidden behind it.
 * The first row goes to the very top so the header shows. A viewport too short for heading and card lets the card win.
 */
export function rowScrollTop(o: { rowTop: number; focusBottom: number; first: boolean; view: number; max: number; header: number }): number {
  if (o.first) return 0;
  const t = Math.max(o.rowTop - o.header - GAP, o.focusBottom + BOTTOM - o.view);
  return clamp(t, o.max);
}

/**
 * New scrollLeft for a row so the card at [left, right] (relative to the row's visible edge) sits in the comfortable band:
 * the safe area plus a peek of the neighbour on each side. Rows end flush at their own padding, never past it.
 */
export function revealX(o: { left: number; right: number; view: number; scrollLeft: number; max: number }): number {
  const lo = SAFE + PEEK;
  const hi = o.view - SAFE - PEEK;
  const d = o.left < lo ? o.left - lo : o.right > hi ? o.right - hi : 0;
  return clamp(o.scrollLeft + d, o.max);
}

/**
 * scrollLeft after a chevron click: about one visible width in `dir`, landing a card on the safe-area edge so no card is cut in half
 * and none is skipped unseen. `offsets` are the cards' lefts in content coordinates.
 */
export function pageTarget(dir: 1 | -1, o: { scrollLeft: number; view: number; max: number; offsets: number[] }): number {
  const raw = o.scrollLeft + dir * (o.view - 2 * SAFE);
  if (raw >= o.max) return o.max;
  if (raw <= 0) return 0;
  const stops = o.offsets.map((x) => x - SAFE).filter((s) => (dir > 0 ? s <= raw && s > o.scrollLeft + 1 : s >= raw && s < o.scrollLeft - 1));
  return stops.length ? (dir > 0 ? Math.max(...stops) : Math.min(...stops)) : raw;
}
