import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { ControllerHelp } from "../components/ControllerHelp";
import styles from "./TvLayout.module.css";

const time = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const pill = ({ isActive }: { isActive: boolean }) => `${styles.pill} ${isActive ? styles.active : ""}`;

function Clock() {
  const [now, setNow] = useState(time);
  useEffect(() => {
    const id = setInterval(() => setNow(time()), 15_000);
    return () => clearInterval(id);
  }, []);
  return <span className={styles.clock}>{now}</span>;
}

/** True once the page is scrolled: the pinned header turns solid so nothing shows half-hidden behind it. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 0);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return scrolled;
}

export function TvLayout() {
  const scrolled = useScrolled();
  return (
    <>
      <header data-app-header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
        <div className={styles.left}>
          <span className={styles.wordmark}>
            <img src="/icon.svg" alt="" width={44} height={44} />
            couch
          </span>
          <nav aria-label="Main" className={styles.nav}>
            <NavLink to="/" end className={pill}>
              Home
            </NavLink>
            <NavLink to="/search" className={pill}>
              Explore
            </NavLink>
          </nav>
        </div>
        <div className={styles.right}>
          <ControllerHelp />
          <Clock />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
