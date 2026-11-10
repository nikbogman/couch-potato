import { createContext, useContext } from "react";
import type { Target } from "../../shared/types";
import type { NowPlaying, RemoteCommand } from "../../shared/playback";

/** Present only under `/remote`: the phone's view of the TV, how to send it somewhere and what to do while it plays. Null on a TV screen. */
export type Remote = {
  tv: boolean;
  play(target: Target): void;
  /** What the TV is playing, or null when idle (or no TV). */
  nowPlaying: NowPlaying | null;
  command(cmd: RemoteCommand): void;
};

export const RemoteContext = createContext<Remote | null>(null);
export const useRemote = () => useContext(RemoteContext);

/** Route prefix for in-app links: the phone keeps to /remote/*, the TV to the root. */
export const useBase = () => (useRemote() ? "/remote" : "");
