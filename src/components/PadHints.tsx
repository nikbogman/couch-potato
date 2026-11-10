import { usePadConnected } from "../navigation/gamepadInput";
import styles from "./PadHints.module.css";

type Hint = { glyph: string; label: string };

/** Controller hint footer: a white glyph (circle for a single letter, pill otherwise) and a label. Rendered only while a gamepad is connected. */
export function PadHints({ hints, className = "" }: { hints: Hint[]; className?: string }) {
  if (!usePadConnected()) return null;
  return (
    <footer aria-label="Controller hints" className={`${styles.hints} ${className}`}>
      {hints.map((h) => (
        <span key={h.glyph + h.label} className={styles.hint}>
          <span aria-hidden="true" className={h.glyph.length === 1 ? styles.circle : styles.pill}>
            {h.glyph}
          </span>
          {h.label}
        </span>
      ))}
    </footer>
  );
}
