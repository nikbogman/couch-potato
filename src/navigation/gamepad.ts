// Pure Xbox-controller decoding: a snapshot of the pad in, discrete actions out. The polling loop lives in gamepadInput.ts.
import type { RemoteCommand } from "../../shared/playback";

export type PadAction = "up" | "down" | "left" | "right" | "a" | "b" | "y" | "lb" | "rb" | "menu";
export type Snapshot = { buttons: boolean[]; axes: number[] };
/** Held actions, with when a held direction may repeat next. */
export type PadState = Partial<Record<PadAction, { next: number }>>;

const DEADZONE = 0.5;
export const REPEAT_DELAY = 400;
export const REPEAT_EVERY = 120;

// "standard" Gamepad mapping
const BUTTONS: Record<number, PadAction> = { 0: "a", 1: "b", 3: "y", 4: "lb", 5: "rb", 9: "menu", 12: "up", 13: "down", 14: "left", 15: "right" };
const ORDER: PadAction[] = ["up", "down", "left", "right", "a", "b", "y", "lb", "rb", "menu"];
export const isDirection = (a: PadAction): a is "up" | "down" | "left" | "right" => a === "up" || a === "down" || a === "left" || a === "right";

function heldActions(s: Snapshot): Set<PadAction> {
  const held = new Set<PadAction>();
  for (const [i, a] of Object.entries(BUTTONS)) if (s.buttons[+i]) held.add(a);
  // The left stick counts as the d-pad on its dominant axis.
  const x = s.axes[0] ?? 0;
  const y = s.axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) >= DEADZONE)
    held.add(Math.abs(x) >= Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up");
  return held;
}

/** Edge-triggered presses; directions held past REPEAT_DELAY repeat every REPEAT_EVERY. Time in ms, any origin. */
export function decodePad(prev: PadState, snap: Snapshot, now: number): { state: PadState; actions: PadAction[] } {
  const held = heldActions(snap);
  const state: PadState = {};
  const actions: PadAction[] = [];
  for (const a of ORDER) {
    if (!held.has(a)) continue;
    const was = prev[a];
    if (!was) {
      actions.push(a);
      state[a] = { next: now + REPEAT_DELAY };
    } else if (isDirection(a) && now >= was.next) {
      actions.push(a);
      state[a] = { next: now + REPEAT_EVERY };
    } else state[a] = was;
  }
  return { state, actions };
}

/** Several pads act as one: any pad's button counts, the strongest axis wins. */
export function mergePads(pads: Snapshot[]): Snapshot {
  const buttons: boolean[] = [];
  const axes: number[] = [0, 0];
  for (const p of pads) {
    p.buttons.forEach((b, i) => b && (buttons[i] = true));
    p.axes.forEach((v, i) => Math.abs(v) > Math.abs(axes[i] ?? 0) && (axes[i] = v));
  }
  return { buttons, axes };
}

/** What a button does during playback: a command for the player, or one of the player screen's own actions. */
export function playbackFor(a: PadAction): RemoteCommand | "back" | "menu" | null {
  switch (a) {
    case "a": return { cmd: "togglePlay" };
    case "left": return { cmd: "seekBy", delta: -10 };
    case "right": return { cmd: "seekBy", delta: 10 };
    case "lb": return { cmd: "seekBy", delta: -30 };
    case "rb": return { cmd: "seekBy", delta: 30 };
    case "y": return { cmd: "nextEpisode" };
    case "b": return "back";
    case "menu": return "menu";
    default: return null;
  }
}
