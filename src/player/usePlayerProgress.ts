import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { saveProgress } from "../lib/api";
import { type Target } from "../../shared/types";
import type { PlayerEvent } from "./playerEvent";
import type { PlayerAdapter } from "./adapters";
import { createPlaybackTracker } from "./progressTracker";

/**
 * Listens to the player iframe's events and saves watch progress for what the player reports playing.
 * Nothing runs until `target` is set (the iframe has been mounted); a new `target` object (or adapter) restarts tracking.
 * `onEvent` sees every event, including `ready` and `episodechange`, so the caller can move the URL or stop a fallback timer.
 * Returns whether progress looks dead, `now()` (what is playing and how far in, for switching players), `leave()`,
 * which awaits a final save so the next screen reads fresh data, and `source()`: the window the player's events come from.
 */
export function usePlayerProgress(target: Target | null, adapter: PlayerAdapter, onEvent: (e: PlayerEvent) => void) {
  const queryClient = useQueryClient();
  const [stalled, setStalled] = useState(false);
  const tracker = useRef<ReturnType<typeof createPlaybackTracker> | null>(null);
  const source = useRef<MessageEventSource | null>(null);
  const handle = useEffectEvent(onEvent);
  // Progress queries are stale the moment a save lands; refetch only after it has, or a page that mounts first reads the old row.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["progress"] });

  useEffect(() => {
    if (!target) return;
    const t = (tracker.current = createPlaybackTracker(target, saveProgress));
    let first = true;
    source.current = null;
    const onMessage = (e: MessageEvent) => {
      const events = adapter.parse(e.origin, e.data, t.target, first);
      if (!events.length) return;
      first = false;
      source.current = e.source;
      for (const event of events) {
        t.onEvent(event);
        handle(event);
      }
      setStalled(false);
    };
    const flush = () => void t.flush();
    const poll = setInterval(() => setStalled(t.stalled()), 1000);
    window.addEventListener("message", onMessage);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(poll);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", flush);
      void t.flush().then(invalidate); // leaving the player by any route, or switching players
      tracker.current = null;
    };
  }, [target, adapter]);

  const leave = async () => {
    await tracker.current?.flush();
    await invalidate();
  };
  const now = () => (tracker.current ? { target: tracker.current.target, position: tracker.current.position } : null);

  return { stalled, leave, now, source: () => source.current };
}
