import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import type { Target } from "../../shared/types";
import { NowPlayingBar } from "../components/NowPlayingBar";
import type { NowPlaying, RemoteCommand } from "../../shared/playback";
import { RemoteContext, type Remote } from "../remote/RemoteContext";
import { connectSocket, type Socket } from "../remote/socket";
import styles from "./RemoteLayout.module.css";

const NOTICE_MS = 2500;

/** Phone shell for `/remote/*`: connects as a remote, shows whether a TV is open, and offers "Play on TV" to the pages below. */
export function RemoteLayout() {
  const [tv, setTv] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const home = pathname.replace(/\/$/, "") === "/remote";

  useEffect(() => {
    const s = connectSocket(
      "remote",
      (m) => {
        if (m.type === "presence") {
          setTv(m.tv);
          if (!m.tv) setNowPlaying(null);
        } else if (m.type === "state") setNowPlaying(m.state);
      },
      (open) => {
        if (!open) {
          setTv(false); // can't hear about the TV while disconnected
          setNowPlaying(null);
        }
      },
    );
    setSocket(s);
    return () => s.close();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  const play = useCallback(
    (target: Target) => {
      socket?.send({ type: "play", target });
      setNotice("Sent to TV");
    },
    [socket],
  );
  const command = useCallback((command: RemoteCommand) => socket?.send({ type: "command", command }), [socket]);
  const remote = useMemo<Remote>(() => ({ tv, play, nowPlaying, command }), [tv, play, nowPlaying, command]);

  return (
    <RemoteContext value={remote}>
      <div className={`remote ${styles.shell}`}>
        <header className={styles.header}>
          {!home && (
            // Opened straight on a subpage (no history entry): Back goes home instead of leaving the app.
            <button type="button" className={styles.back} aria-label="Back" onClick={() => (key === "default" ? navigate("/remote") : navigate(-1))}>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          <Link to="/remote" className={styles.wordmark}>
            <img src="/icon.svg" alt="" width={28} height={28} />
            couch
          </Link>
          <span className={`${styles.chip} ${tv ? styles.live : ""}`} role="status">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            {tv ? "TV connected" : "No TV"}
          </span>
        </header>
        <main>
          <Outlet />
        </main>
        <NowPlayingBar />
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </div>
    </RemoteContext>
  );
}
