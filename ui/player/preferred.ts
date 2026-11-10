// The player a title starts in: the one last chosen on a title page or in the player, else DEFAULT_PLAYER. Per device (localStorage).
import { useSyncExternalStore } from "react";
import { PLAYER_IDS, type PlayerId } from "../../shared/types";
import { DEFAULT_PLAYER, playerFromParam } from "./adapters";

const KEY = "preferredPlayer";
const listeners = new Set<() => void>();

export function preferredPlayer(): PlayerId {
  try {
    return playerFromParam(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_PLAYER;
  }
}

export function setPreferredPlayer(p: PlayerId) {
  try {
    localStorage.setItem(KEY, p);
  } catch {}
  listeners.forEach((l) => l());
}

/** The next player in order, wrapping: what the title page's "Player N" button moves to. */
export const nextPlayer = (p: PlayerId): PlayerId => PLAYER_IDS[(PLAYER_IDS.indexOf(p) + 1) % PLAYER_IDS.length]!;

export const usePreferredPlayer = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    preferredPlayer,
    () => DEFAULT_PLAYER,
  );
