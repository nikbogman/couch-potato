import { useEffect, useState } from "react";
import { APP_NAME, BrandMark } from "../components/Brand";
import { NavLink, Outlet } from "react-router";
import { ControllerHelp } from "../components/ControllerHelp";
import styles from "./TvLayout.module.css";

const pill = ({ isActive }: { isActive: boolean }) => `${styles.pill} ${isActive ? styles.active : ""}`;

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
          <span className={styles.wordmark} translate="no">
            <BrandMark size={44} />
            {APP_NAME}
          </span>
          <nav aria-label="Main" className={styles.nav}>
            <NavLink to="/" end className={pill}>
              Home
            </NavLink>
            <NavLink to="/search" className={pill}>
              Explore
            </NavLink>
            <NavLink to="/lists" className={pill}>
              My lists
            </NavLink>
          </nav>
        </div>
        <div className={styles.right}>
          <ControllerHelp />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
