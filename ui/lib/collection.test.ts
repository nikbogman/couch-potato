import { expect, test } from "bun:test";
import { listUrl, toggle, type Entry } from "./collection";

const out: Entry = { status: null, favourite: false, watchedAt: null };
const toWatch: Entry = { status: "to_watch", favourite: false, watchedAt: null };
const fav: Entry = { status: "watched", favourite: true, watchedAt: 1 };

test("pressing a toggle sets it; pressing the active one clears it", () => {
  expect(toggle(out, "to_watch")).toEqual({ status: "to_watch" });
  expect(toggle(toWatch, "to_watch")).toEqual({ status: null });
  expect(toggle(toWatch, "watched")).toEqual({ status: "watched" });
  expect(toggle(out, "favourites")).toEqual({ favourite: true });
  expect(toggle(fav, "favourites")).toEqual({ favourite: false });
});

test("list urls carry the list, order and offset, and a trimmed title only when there is one", () => {
  expect(listUrl("watched")).toBe("/api/collection?list=watched&order=newest&offset=0");
  expect(listUrl("to_watch", { title: "  heat ", oldestFirst: true, offset: 30 })).toBe("/api/collection?list=to_watch&order=oldest&offset=30&title=heat");
});
