import { expect, test } from "bun:test";
import { nextPlayer } from "./preferred";

test("the Player button steps through 1, 2, 3 and wraps", () => {
  expect(nextPlayer("p1")).toBe("p2");
  expect(nextPlayer("p2")).toBe("p3");
  expect(nextPlayer("p3")).toBe("p1");
});
