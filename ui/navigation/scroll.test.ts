import { expect, test } from "bun:test";
import { revealX, rowScrollTop } from "./scroll";

// Page scroll for a focused row (document coordinates).
const row = { rowTop: 1000, focusBottom: 1480, view: 1080, max: 5000, header: 112 };

test("the focused row's heading lands just below the pinned header", () => {
  expect(rowScrollTop({ ...row, first: false })).toBe(1000 - 112 - 24);
});

test("the first row scrolls to the very top so the header shows", () => {
  expect(rowScrollTop({ ...row, rowTop: 160, focusBottom: 640, first: true })).toBe(0);
});

test("never scrolls past the end of the page, nor before its start", () => {
  expect(rowScrollTop({ ...row, rowTop: 4900, focusBottom: 5380, first: false, max: 4000 })).toBe(4000);
  expect(rowScrollTop({ ...row, rowTop: 20, focusBottom: 500, first: false })).toBe(0);
});

test("on a short viewport the focused card wins over the heading", () => {
  const t = rowScrollTop({ rowTop: 1000, focusBottom: 1480, view: 500, max: 5000, header: 112, first: false });
  expect(1480 - t).toBeLessThanOrEqual(500 - 24); // card bottom clear of the bottom edge
});

// Sideways reveal inside a row: card rect relative to the scrollport, safe area 96, peek 100.
const x = { view: 1920, scrollLeft: 0, max: 2880 };

test("a card already inside the comfortable band does not move the row", () => {
  expect(revealX({ ...x, left: 500, right: 700 })).toBe(0);
});

test("moving right keeps a peek of the next card; moving left a peek of the previous one", () => {
  expect(revealX({ ...x, left: 1500, right: 1800 })).toBe(1800 - (1920 - 96 - 100));
  expect(revealX({ ...x, scrollLeft: 800, max: 2880, left: 120, right: 320 })).toBe(800 - (96 + 100 - 120));
});

test("the ends of the row keep the safe-area padding and never overshoot", () => {
  expect(revealX({ ...x, scrollLeft: 2800, left: 1500, right: 1824 })).toBe(2880); // last card: row stops at its padding
  expect(revealX({ ...x, scrollLeft: 50, left: 130, right: 330 })).toBe(0);
});

// Chevron paging: about one visible width, landing on a card boundary, never skipping a card unseen.
const offsets = [96, 328, 560, 792, 1024, 1256, 1488, 1720, 1952, 2184, 2416, 2648]; // card lefts in content coordinates
