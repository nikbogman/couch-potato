import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import type { Target } from "../../shared/types";
import { NowPlayingBar } from "../components/NowPlayingBar";
import type { NowPlaying, RemoteCommand } from "../../shared/playback";
import { RemoteContext, type Remote } from "../remote/RemoteContext";
import { connectSocket, type Socket } from "../remote/socket";
import styles from "./RemoteLayout.module.css";

const NOTICE_MS = 2500;

const TABS = [
  { to: "/remote", label: "Home", end: true, icon: <path d="M4 11l8-7 8 7v9H4z" strokeLinejoin="round" /> },
  { to: "/remote/lists", label: "Lists", icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  { to: "/remote/now-playing", label: "Remote", icon: <><rect x="7" y="2" width="10" height="20" rx="3" /><circle cx="12" cy="9" r="2" /></> },
  { to: "/remote/search", label: "Explore", icon: <><circle cx="12" cy="12" r="8" /><path d="M15 9l-2 4-4 2 2-4z" /></> },
];

function TabBar() {
  return (
    <footer className={styles.tabbar}>
      <nav aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={styles.tab}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {t.icon}
            </svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </footer>
  );
}

/** Phone shell for `/remote/*`: connects as a remote, shows whether a TV is open, and offers "Play on TV" to the pages below. */
export function RemoteLayout() {
  const [tv, setTv] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const home = TABS.some((t) => t.to === pathname.replace(/\/$/, "")); // tab roots have no Back

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
        {!home && (
          // Subpages only: tab roots start with their own title (designs: Phone · Lists, Explore, Remote).
          <header className={styles.header}>
            {/* Opened straight on a subpage (no history entry): Back goes home instead of leaving the app. */}
            <button type="button" className={styles.back} aria-label="Back" onClick={() => (key === "default" ? navigate("/remote") : navigate(-1))}>
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          </header>
        )}
        <main>
          <Outlet />
        </main>
        <NowPlayingBar />
        <TabBar />
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </div>
    </RemoteContext>
  );
}
