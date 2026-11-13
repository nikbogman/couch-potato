import { useState } from "react";
import type { Kicked } from "./socket";
import styles from "./Kicked.module.css";

/**
 * What to do when the relay ends this screen's socket on purpose.
 * Unpaired, or the session was replaced by another device: back to pairing (TV) or sign-in (phone), saying why.
 * Replaced but still signed in (the same TV or phone opened in a second tab): `InUseElsewhere`, until "Use here".
 */
export function useKicked(role: "tv" | "remote") {
  const [elsewhere, setElsewhere] = useState(false);
  const signIn = role === "tv" ? "/pair" : "/login";
  const onKicked = async (why: Kicked) => {
    if (why === "signedOut") return location.replace(signIn);
    const me = await fetch("/api/me").catch(() => null);
    if (me?.status === 401) location.replace(`${signIn}?replaced=1`);
    else setElsewhere(true);
  };
  return { onKicked, elsewhere };
}

export function InUseElsewhere() {
  return (
    <div className={styles.veil} role="alertdialog" aria-labelledby="elsewhere-title">
      <h2 id="elsewhere-title">Open on another screen</h2>
      <p>couch potato was opened somewhere else with this account, so this screen stopped.</p>
      <button type="button" autoFocus onClick={() => location.reload()}>
        Use here
      </button>
    </div>
  );
}
