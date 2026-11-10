import { parseServerMessage, type ClientMessage, type Role, type ServerMessage } from "../../shared/protocol";

export const backoff = (attempt: number) => Math.min(10_000, 500 * 2 ** attempt);

const PING_EVERY_MS = 20_000;
const PONG_WAIT_MS = 5_000;

const wsUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export type Socket = { send(m: ClientMessage): void; close(): void };

/**
 * A WebSocket to the server that announces `role` on every (re)connect and reconnects with backoff when it drops.
 * `onOpen(false)` fires while it's down, so a phone doesn't claim a TV it can no longer hear about.
 * Leaving the page drops the socket even when the browser keeps the page in its back/forward cache, where it would
 * otherwise stay connected: a TV that has moved on to another site would still count as open and still get casts.
 */
export function connectSocket(
  role: Role,
  onMessage: (m: ServerMessage) => void,
  onOpen: (open: boolean) => void = () => {},
  // seams for tests
  dial: (url: string) => WebSocket = (u) => new WebSocket(u),
  later: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  heartbeat: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
): Socket {
  let ws: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let closed = false;
  let beat: ReturnType<typeof setTimeout> | undefined;
  let dead: ReturnType<typeof setTimeout> | undefined;

  // A phone that slept or lost signal can hold a socket that looks open but hears nothing, and no close event comes for minutes.
  // The server answers "ping" with "pong"; no pong in time means the socket is dead, so dial a new one.
  const ping = () => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send("ping");
    clearTimeout(dead);
    dead = heartbeat(redial, PONG_WAIT_MS);
  };
  const redial = () => {
    clearTimeout(timer);
    clearTimeout(beat);
    clearTimeout(dead);
    if (ws) ws.onclose = null;
    ws?.close();
    onOpen(false);
    attempt = 0;
    start();
  };

  const start = () => {
    const sock = (ws = dial(wsUrl()));
    sock.onopen = () => {
      attempt = 0;
      sock.send(JSON.stringify({ type: "hello", role } satisfies ClientMessage));
      onOpen(true);
      beat = heartbeat(ping, PING_EVERY_MS);
    };
    sock.onmessage = (e) => {
      if (e.data === "pong") {
        clearTimeout(dead);
        clearTimeout(beat);
        beat = heartbeat(ping, PING_EVERY_MS);
        return;
      }
      const m = typeof e.data === "string" ? parseServerMessage(e.data) : null;
      if (m) onMessage(m);
    };
    sock.onclose = () => {
      if (closed) return;
      clearTimeout(beat);
      clearTimeout(dead);
      onOpen(false);
      timer = later(start, backoff(attempt++));
    };
  };
  start();

  const hide = () => {
    clearTimeout(timer);
    clearTimeout(beat);
    clearTimeout(dead);
    if (ws) ws.onclose = null;
    ws?.close();
    ws = undefined;
    onOpen(false);
  };
  const show = (e: PageTransitionEvent) => {
    if (!e.persisted || closed) return; // a normal load builds a fresh socket anyway
    attempt = 0;
    start();
  };
  const wake = () => document.visibilityState === "visible" && ping(); // back from sleep: check now, don't wait for the next beat
  globalThis.addEventListener?.("pagehide", hide);
  globalThis.addEventListener?.("online", ping);
  globalThis.document?.addEventListener?.("visibilitychange", wake);
  globalThis.addEventListener?.("pageshow", show as EventListener);

  return {
    send(m) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    },
    close() {
      closed = true;
      globalThis.removeEventListener?.("pagehide", hide);
      globalThis.removeEventListener?.("online", ping);
      globalThis.document?.removeEventListener?.("visibilitychange", wake);
      clearTimeout(beat);
      clearTimeout(dead);
      globalThis.removeEventListener?.("pageshow", show as EventListener);
      clearTimeout(timer);
      ws?.close();
    },
  };
}
