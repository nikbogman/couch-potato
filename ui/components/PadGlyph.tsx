import type { PadFamily } from "../navigation/gamepad";
import styles from "./PadGlyph.module.css";

export type PadButton = "a" | "b" | "x" | "y" | "lb" | "rb" | "lt" | "rt" | "view" | "menu" | "dpad" | "leftRight";

const XBOX = { a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", lt: "LT", rt: "RT", view: "View", menu: "Menu" } as const;
/** SHARE on a PS4 pad, CREATE on a PS5 one: same button. */
const PS = { lb: "L1", rb: "R1", lt: "L2", rt: "R2", view: "SHARE", menu: "OPTIONS" } as const;
/** PlayStation face buttons are shapes, not letters: ✕ ○ □ △ in the same places as A B X Y. */
const SHAPES = {
  a: <path d="M5 5l14 14M19 5L5 19" />,
  b: <circle cx="12" cy="12" r="8" />,
  x: <rect x="5" y="5" width="14" height="14" />,
  y: <path d="M12 4l9 16H3z" strokeLinejoin="round" />,
} as const;
const NAMES = { ps: { a: "Cross", b: "Circle", x: "Square", y: "Triangle" }, xbox: XBOX } as const;

/** One controller button, labelled as on the connected pad (Xbox letters or PlayStation shapes), coloured like the real thing. */
export function PadGlyph({ b, family }: { b: PadButton; family: PadFamily }) {
  if (b === "dpad")
    return (
      <svg className={styles.dpad} viewBox="0 0 24 24" aria-label="D-pad" role="img">
        <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
      </svg>
    );
  if (b === "leftRight") return <span className={styles.pill} aria-label="Left, right">◀ ▶</span>;
  if (b === "a" || b === "b" || b === "x" || b === "y")
    return family === "ps" ? (
      <span className={`${styles.face} ${styles.ps} ${styles[b]}`} role="img" aria-label={NAMES.ps[b]}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          {SHAPES[b]}
        </svg>
      </span>
    ) : (
      <span className={`${styles.face} ${styles[b]}`}>{XBOX[b]}</span>
    );
  if (b === "view" && family === "xbox")
    return (
      <span className={styles.pill} role="img" aria-label="View">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="13" height="10" rx="1.5" />
          <path d="M8 18h11.5a1.5 1.5 0 0 0 1.5-1.5V9" />
        </svg>
      </span>
    );
  if (b === "menu" && family === "xbox")
    return (
      <span className={styles.pill} role="img" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </span>
    );
  return <span className={styles.pill}>{family === "ps" ? PS[b] : XBOX[b]}</span>;
}
