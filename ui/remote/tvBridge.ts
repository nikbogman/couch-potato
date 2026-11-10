import type { NowPlaying, RemoteCommand } from "../../shared/playback";

/** What the active player screen offers the TV socket. */
export type PlayerHandle = {
  run(cmd: RemoteCommand): void;
  /** Ask the player for its status and push fresh state now. */
  sync(): void;
};

let handle: PlayerHandle | null = null;
let sink: (s: NowPlaying | null) => void = () => {};

/**
 * The one seam between the app-level TV socket (TvClient) and whichever PlayerScreen is mounted:
 * commands go in through `run`, state comes out through `push`. A module, not React context, because both ends are effects.
 */
export const tvBridge = {
  attach(h: PlayerHandle) {
    handle = h;
    return () => void (handle === h && (handle = null));
  },
  /** TvClient sets where state goes (the socket). */
  setSink(fn: (s: NowPlaying | null) => void) {
    sink = fn;
    return () => void (sink === fn && (sink = () => {}));
  },
  push: (s: NowPlaying | null) => sink(s),
  run: (cmd: RemoteCommand) => handle?.run(cmd),
  /** True if a player took it. */
  sync() {
    handle?.sync();
    return !!handle;
  },
};
