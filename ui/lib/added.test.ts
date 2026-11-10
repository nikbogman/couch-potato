import { expect, test } from "bun:test";
import { addedAgo } from "./added";

const now = new Date(2026, 10, 10, 15).getTime(); // 10 Nov 2026, 15:00 local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

test("recent days by name, then weeks, then the month", () => {
  expect(addedAgo(at(2026, 10, 10, 1), now)).toBe("today");
  expect(addedAgo(at(2026, 10, 9, 23), now)).toBe("yesterday");
  expect(addedAgo(at(2026, 10, 7), now)).toBe("3 days ago");
  expect(addedAgo(at(2026, 10, 1), now)).toBe("last week");
  expect(addedAgo(at(2026, 9, 12), now)).toBe("in October");
  expect(addedAgo(at(2025, 11, 30), now)).toBe("in Dec 2025");
  expect(addedAgo(now + 60_000, now)).toBe("today"); // clock skew never says "in the future"
});
