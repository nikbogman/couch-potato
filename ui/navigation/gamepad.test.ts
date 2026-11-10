import { expect, test } from "bun:test";
import { decodePad, mergePads, playbackFor, REPEAT_DELAY, REPEAT_EVERY, type PadState, type Snapshot } from "./gamepad";

const snap = (pressed: number[] = [], axes: number[] = [0, 0]): Snapshot => {
  const buttons = Array<boolean>(17).fill(false);
  for (const i of pressed) buttons[i] = true;
  return { buttons, axes };
};
/** Feed snapshots at (time, snapshot) pairs and collect the actions of each step. */
const run = (steps: [number, Snapshot][]) => {
  let state: PadState = {};
  return steps.map(([t, s]) => {
    const r = decodePad(state, s, t);
    state = r.state;
    return r.actions;
  });
};

test("buttons fire once per press, not while held", () => {
  expect(run([[0, snap([0])], [16, snap([0])], [32, snap([])], [48, snap([0])]])).toEqual([["a"], [], [], ["a"]]);
});

test("maps the standard buttons", () => {
  const pressed = run([[0, snap([0, 1, 3, 4, 5, 9])]])[0];
  expect(pressed).toEqual(["a", "b", "y", "lb", "rb", "menu"]);
  expect(run([[0, snap([12, 13, 14, 15])]])[0]).toEqual(["up", "down", "left", "right"]);
});

test("a held direction repeats after the delay, then at the repeat interval", () => {
  const steps: [number, Snapshot][] = [[0, snap([15])]];
  for (let t = 16; t <= REPEAT_DELAY + 3 * REPEAT_EVERY + 16; t += 16) steps.push([t, snap([15])]);
  const fired = run(steps).flatMap((a, i) => (a.length ? [steps[i]![0]] : []));
  expect(fired[0]).toBe(0);
  expect(fired[1]).toBeGreaterThanOrEqual(REPEAT_DELAY);
  expect(fired[1]).toBeLessThan(REPEAT_DELAY + 16);
  expect(fired[2]! - fired[1]!).toBeGreaterThanOrEqual(REPEAT_EVERY);
  expect(fired[2]! - fired[1]!).toBeLessThan(REPEAT_EVERY + 16);
});

test("non-direction buttons never repeat", () => {
  const steps: [number, Snapshot][] = [];
  for (let t = 0; t <= 2000; t += 16) steps.push([t, snap([0])]);
  expect(run(steps).flat()).toEqual(["a"]);
});

test("the left stick acts like the d-pad once past the deadzone, on the dominant axis", () => {
  expect(run([[0, snap([], [0.4, 0])]])[0]).toEqual([]);
  expect(run([[0, snap([], [0.9, 0.2])]])[0]).toEqual(["right"]);
  expect(run([[0, snap([], [-0.2, -0.8])]])[0]).toEqual(["up"]);
  expect(run([[0, snap([], [-0.7, 0.6])]])[0]).toEqual(["left"]);
});

test("stick and d-pad holding the same direction do not double fire", () => {
  expect(run([[0, snap([15], [0.9, 0])]])[0]).toEqual(["right"]);
});

test("releasing and pressing again restarts the repeat clock", () => {
  const r = run([[0, snap([14])], [100, snap([])], [200, snap([14])], [300, snap([14])]]);
  expect(r).toEqual([["left"], [], ["left"], []]);
});

test("several pads are merged into one", () => {
  const m = mergePads([snap([0], [0.2, 0]), snap([14], [-0.9, 0.1])]);
  expect(m.buttons[0] && m.buttons[14]).toBe(true);
  expect(m.axes).toEqual([-0.9, 0.1]);
  expect(mergePads([]).buttons.some(Boolean)).toBe(false);
});

test("playback mapping", () => {
  expect(playbackFor("a")).toEqual({ cmd: "togglePlay" });
  expect(playbackFor("left")).toEqual({ cmd: "seekBy", delta: -10 });
  expect(playbackFor("right")).toEqual({ cmd: "seekBy", delta: 10 });
  expect(playbackFor("lb")).toEqual({ cmd: "seekBy", delta: -30 });
  expect(playbackFor("rb")).toEqual({ cmd: "seekBy", delta: 30 });
  expect(playbackFor("y")).toEqual({ cmd: "nextEpisode" });
  expect(playbackFor("b")).toBe("back");
  expect(playbackFor("menu")).toBe("menu");
  expect(playbackFor("up")).toBeNull();
});
