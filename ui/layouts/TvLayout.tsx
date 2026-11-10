import { useEffect, useState } from "react";
import { APP_NAME, BrandMark } from "../components/Brand";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
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

/** Title pages have no tab bar, only Back (designs: TV · Title). */
const isTitlePage = (path: string) => /^\/(movie|tv)\//.test(path);

export function TvLayout() {
  const scrolled = useScrolled();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (isTitlePage(pathname))
    return (
      <>
        <header data-app-header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
          <button type="button" className={styles.back} onClick={() => (history.state?.idx > 0 ? navigate(-1) : navigate("/"))}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </button>
        </header>
        <main>
          <Outlet />
        </main>
      </>
    );
  return (
    <>
      <header data-app-header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
        <div className={styles.left}>
          <span className={styles.wordmark} translate="no">
            <BrandMark size={40} />
            {APP_NAME}
          </span>
        </div>
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
        <div className={styles.right}>
          <Link to="/search" className={styles.icon} aria-label="Search">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
          </Link>
          <ControllerHelp />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
