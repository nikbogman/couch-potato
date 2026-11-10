import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Target } from "../../shared/types";
import { watchPath } from "../../shared/protocol";
import { useRemote } from "../remote/RemoteContext";
import { APP_NAME } from "./Brand";
import { DEFAULT_PLAYER } from "../player/adapters";
import { usePreferredPlayer } from "../player/preferred";
import { PlayGlyph } from "./TitleHero";

export const PLAY_ON_TV = (
  <>
    <PlayGlyph size={20} />
    Play on TV
  </>
);

/**
 * Starts a title or episode. On the TV it's a link to the player; on the phone a button that sends the TV there
 * (disabled while no TV is open). `remoteLabel` replaces the children on the phone, for the big hero button.
 */
export function PlayButton({
  target,
  remoteLabel,
  children,
  ...props
}: {
  target: Target;
  remoteLabel?: ReactNode;
  children: ReactNode;
  className?: string;
  autoFocus?: boolean;
  "data-episode"?: number;
}) {
  const remote = useRemote();
  const player = usePreferredPlayer(); // starts in the player chosen on the title page
  if (!remote)
    return (
      <Link to={watchPath(target) + (player === DEFAULT_PLAYER ? "" : `?player=${player}`)} {...props}>
        {children}
      </Link>
    );
  const { autoFocus: _, ...rest } = props; // the TV's focus-the-primary-action rule doesn't apply on a touch screen
  return (
    <button type="button" disabled={!remote.tv} onClick={() => remote.play(target)} {...rest}>
      {remoteLabel ?? children}
    </button>
  );
}

/** Shown near a phone's Play button while no TV is connected. */
export function NoTvNote({ className }: { className?: string }) {
  const remote = useRemote();
  return remote && !remote.tv ? <span className={className}>Open {APP_NAME} on the TV</span> : null;
}
