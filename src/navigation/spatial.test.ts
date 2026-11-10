import { expect, test } from "bun:test";
import { pickJump, pickNext, type Rect } from "./spatial";

const r = (left: number, top: number, w = 100, h = 100): Rect => ({ left, top, right: left + w, bottom: top + h });

test("moves to the nearest neighbour in the pressed direction", () => {
  const row = [r(0, 0), r(150, 0), r(300, 0)];
  expect(pickNext(row[1]!, row, "right")).toBe(2);
  expect(pickNext(row[1]!, row, "left")).toBe(0);
  expect(pickNext(row[2]!, row, "right")).toBe(-1);
  expect(pickNext(row[0]!, row, "up")).toBe(-1);
});

test("never picks itself or same-row neighbours for up and down", () => {
  const row = [r(0, 0), r(150, 0), r(300, 0)];
  expect(pickNext(row[1]!, row, "down")).toBe(-1);
});

test("down from a card prefers the aligned card in the next row over a nearer misaligned one", () => {
  const from = r(300, 0, 200, 300);
  const next = [r(0, 340, 200, 300), r(250, 340, 200, 300), r(500, 340, 200, 300)];
  expect(pickNext(from, [from, ...next], "down")).toBe(2);
});

test("cross-axis alignment beats a slightly closer element", () => {
  const from = r(0, 0, 100, 100);
  const aligned = r(0, 300, 100, 100); // straight down, further
  const nearer = r(600, 120, 100, 100); // closer vertically but far to the side
  expect(pickNext(from, [from, nearer, aligned], "down")).toBe(2);
});

test("rows scroll sideways: off-screen cards are still reachable and the aligned one is chosen", () => {
  const from = r(1500, 0, 280, 400);
  const below = [r(0, 440, 280, 400), r(1450, 440, 280, 400), r(1800, 440, 280, 400), r(2400, 440, 280, 400)];
  expect(pickNext(from, [from, ...below], "down")).toBe(2);
  expect(pickNext(below[3]!, [from, ...below], "left")).toBe(3);
});

test("a long list moves one row at a time", () => {
  const rows = [0, 1, 2, 3].map((i) => r(96, i * 180, 1700, 160));
  expect(pickNext(rows[1]!, rows, "down")).toBe(2);
  expect(pickNext(rows[1]!, rows, "up")).toBe(0);
});

test("tabs above a list: up from an episode goes to the tab, not to the row above the tabs", () => {
  const hero = r(96, 0, 400, 100);
  const tab = r(96, 120, 160, 60);
  const ep = r(96, 200, 1700, 160);
  expect(pickNext(ep, [hero, tab, ep], "up")).toBe(1);
});

test("a button on a card is reachable vertically (up from the card, down from the button)", () => {
  const card = r(0, 0, 300, 400);
  const remove = r(242, 10, 48, 48);
  expect(pickNext(card, [card, remove], "up")).toBe(1);
  expect(pickNext(remove, [card, remove], "down")).toBe(0);
});

test("Home/End go to the first/last item of the focused row, even when it is scrolled off-screen", () => {
  const row1 = [r(-400, 0), r(-200, 0), r(0, 0), r(2400, 0)];
  const row2 = [r(0, 200), r(2000, 200)];
  const all = [...row1, ...row2];
  expect(pickJump(row1[2]!, all, "home")).toBe(0);
  expect(pickJump(row1[2]!, all, "end")).toBe(3);
  expect(pickJump(row2[0]!, all, "end")).toBe(5);
});

test("Home/End in a one-column list go to the top/bottom", () => {
  const list = [r(0, 0, 500), r(0, 120, 500), r(0, 240, 500), r(0, 360, 500)];
  expect(pickJump(list[1]!, list, "home")).toBe(0);
  expect(pickJump(list[1]!, list, "end")).toBe(3);
});

test("PageDown/PageUp jump about a page, keep the column and stop at the ends", () => {
  const grid = [0, 1, 2, 3, 4, 5].flatMap((row) => [r(0, row * 200), r(150, row * 200)]); // 2 columns, 6 rows
  expect(pickJump(grid[1]!, grid, "pageDown", 400)).toBe(5); // two rows down, same column
  expect(pickJump(grid[5]!, grid, "pageUp", 400)).toBe(1);
  expect(pickJump(grid[11]!, grid, "pageDown", 400)).toBe(-1); // already on the last row
  expect(pickJump(grid[0]!, grid, "pageUp", 400)).toBe(-1);
  expect(pickJump(grid[9]!, grid, "pageDown", 800)).toBe(11); // a short page still ends on the last row
});

test("left/right stop at the end of a row instead of jumping to a card in another row", () => {
  const row1 = [r(0, 0, 200, 300), r(232, 0, 200, 300)];
  const row2 = [r(0, 400, 200, 300), r(232, 400, 200, 300), r(464, 400, 200, 300)];
  const all = [...row1, ...row2];
  expect(pickNext(row1[1]!, all, "right")).toBe(-1); // row 2 has a card further right, but it is not this row
  expect(pickNext(row2[0]!, all, "left")).toBe(-1);
});
