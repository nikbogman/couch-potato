import { expect, test } from "bun:test";
import { formatRuntime, timeLeft } from "./format";

test("time left reads like a streaming app", () => {
  expect(timeLeft(1000, 1000 + 72 * 60)).toBe("1h 12m left");
  expect(timeLeft(0, 2 * 3600)).toBe("2h left");
  expect(timeLeft(0, 45 * 60)).toBe("45m left");
  expect(timeLeft(0, 45 * 60 + 20)).toBe("46m left"); // rounds up so it never says 0
  expect(timeLeft(990, 1000)).toBe("1m left");
});

test("runtimes are short", () => {
  expect(formatRuntime(136)).toBe("2h 16m");
  expect(formatRuntime(45)).toBe("45m");
});
