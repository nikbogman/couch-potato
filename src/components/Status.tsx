import type { ReactNode } from "react";
import styles from "./Status.module.css";

/** A muted one-line status inside a section: "Loading…", "No results", a count. */
export const Status = ({ children }: { children: ReactNode }) => <p className={styles.status}>{children}</p>;

/** "Couldn't load X. Try again", announced to screen readers. */
export function LoadError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <p className={styles.status} role="alert">
      Couldn&rsquo;t load {what}.{" "}
      <button type="button" className={styles.retry} onClick={retry}>
        Try again
      </button>
    </p>
  );
}

/** A whole-page message: loading, not found, an error. */
export const PageMessage = ({ children }: { children: ReactNode }) => <p className={styles.page}>{children}</p>;
