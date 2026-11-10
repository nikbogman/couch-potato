// Gamepad polling: starts when a pad is connected, turns the pure decoder's actions into events anyone can subscribe to.
import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { decodePad, mergePads, type PadAction, type PadState, type Snapshot } from "./gamepad";

const listeners = new Set<(a: PadAction) => void>();
const watchers = new Set<() => void>();
let connected = false;
let frame = 0;
let state: PadState = {};

const snapshot = (p: Gamepad): Snapshot => ({ buttons: p.buttons.map((b) => b.pressed), axes: [...p.axes] });
const connectedPads = () => [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p && p.connected);

function setConnected(c: boolean) {
  if (c === connected) return;
  connected = c;
  watchers.forEach((w) => w());
}

function tick(now: number, fresh = false) {
  const pads = connectedPads();
  setConnected(pads.length > 0);
  if (!pads.length) return void (frame = 0); // 'gamepadconnected' restarts the loop
  const r = decodePad(fresh ? {} : state, mergePads(pads.map(snapshot)), now);
  state = r.state;
  // The press that woke the pad up (or a button held across a reload) isn't an action.
  if (!fresh) for (const a of r.actions) listeners.forEach((l) => l(a));
  frame = requestAnimationFrame((t) => tick(t));
}

/** Idempotent. Polls only while a pad is connected. Returns a stop function. */
export function startPad() {
  const kick = () => frame || (frame = requestAnimationFrame((t) => tick(t, true)));
  addEventListener("gamepadconnected", kick);
  kick();
  return () => {
    removeEventListener("gamepadconnected", kick);
    cancelAnimationFrame(frame);
    frame = 0;
  };
}

/** Subscribe to controller actions. Returns the unsubscribe. */
function onPad(fn: (a: PadAction) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Runs `handler` for every controller action while `enabled`. */
export function usePad(handler: (a: PadAction) => void, enabled = true) {
  const h = useEffectEvent(handler);
  useEffect(() => (enabled ? onPad(h) : undefined), [enabled]);
}

/** True while a gamepad is connected (drives the hint footers). */
export function usePadConnected() {
  return useSyncExternalStore(
    (w) => {
      watchers.add(w);
      return () => void watchers.delete(w);
    },
    () => connected,
    () => false,
  );
}
