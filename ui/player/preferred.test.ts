import { expect, test } from "bun:test";
import { nextPlayer } from "./preferred";

test("the Player button steps through 1, 2, 3 and wraps", () => {
  expect(nextPlayer("playerone")).toBe("playertwo");
  expect(nextPlayer("playertwo")).toBe("playerthree");
  expect(nextPlayer("playerthree")).toBe("playerone");
});
