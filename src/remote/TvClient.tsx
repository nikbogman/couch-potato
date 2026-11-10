import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router";
import { watchPath, type ServerMessage } from "../../shared/protocol";
import { connectSocket, type Socket } from "./socket";
import { tvBridge } from "./tvBridge";

// How many phone remotes the relay says are connected; 0 while this TV's socket is down.
let remotes = 0;
const listeners = new Set<() => void>();
const setRemotes = (n: number) => {
  remotes = n;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
/** True while at least one phone remote is connected to this TV. */
export const usePhoneConnected = () => useSyncExternalStore(subscribe, () => remotes > 0);

/**
 * Makes every non-remote screen a "tv" client. Mounted once above the routes so the socket survives
 * TvLayout ↔ Player navigation. It sends the TV to the player when a phone asks, hands playback commands to the mounted player
 * (via `tvBridge`) and reports what is playing, or idle anywhere else.
 */
export function TvClient() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const socket = useRef<Socket | null>(null);
  const isRemote = pathname === "/remote" || pathname.startsWith("/remote/");

  // A URL change the player didn't make itself is a fresh load, so casting a new title reloads it.
  const onMessage = useEffectEvent((m: ServerMessage) => {
    if (m.type === "play") navigate(watchPath(m.target));
    else if (m.type === "command") tvBridge.run(m.command);
    else if (m.type === "sync") sync();
    else if (m.type === "remotes") setRemotes(m.count);
  });
  // A player screen answers with fresh state; anywhere else the answer is "idle".
  const sync = () => {
    if (!tvBridge.sync()) socket.current?.send({ type: "state", state: null });
  };
  const opened = useEffectEvent((open: boolean) => (open ? sync() : setRemotes(0)));

  useEffect(() => {
    if (isRemote) return;
    const s = (socket.current = connectSocket("tv", onMessage, opened));
    const unsink = tvBridge.setSink((state) => s.send({ type: "state", state }));
    const active = () => document.visibilityState === "visible" && s.send({ type: "active" });
    window.addEventListener("focus", active);
    document.addEventListener("visibilitychange", active);
    return () => {
      window.removeEventListener("focus", active);
      document.removeEventListener("visibilitychange", active);
      unsink();
      s.close();
      socket.current = null;
    };
  }, [isRemote]);

  // Navigating is activity: the screen someone is using is the screen to cast to.
  useEffect(() => {
    socket.current?.send({ type: "active" });
    if (!pathname.startsWith("/watch/")) socket.current?.send({ type: "state", state: null });
  }, [pathname]);
  return null;
}
