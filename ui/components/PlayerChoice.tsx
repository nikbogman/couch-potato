import { ADAPTERS } from "../player/adapters";
import { nextPlayer, setPreferredPlayer, usePreferredPlayer } from "../player/preferred";
import { useRemote } from "../remote/RemoteContext";
import { heroAction } from "./TitleHero";

/** "Player 3" on a TV title page (designs: TV · Title): pressing it moves to the next player, which Play then starts in. */
export function PlayerChoice() {
  const player = usePreferredPlayer();
  if (useRemote()) return null; // the phone switches players from the Remote tab
  return (
    <button type="button" className={heroAction.toggle} onClick={() => setPreferredPlayer(nextPlayer(player))} aria-label={`Player ${ADAPTERS[player].label}. Change player`}>
      Player {ADAPTERS[player].label}
    </button>
  );
}
