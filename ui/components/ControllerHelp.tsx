import { useEffect, useRef } from "react";
import { usePadConnected } from "../navigation/gamepadInput";
import { usePhoneConnected } from "../remote/TvClient";
import glyphs from "./PadHints.module.css";
import styles from "./ControllerHelp.module.css";

/** Fired by the controller's Menu button outside the player (see navigation/Navigation.tsx). */
export const HELP_EVENT = "couch:help";

type Row = { pad: string[]; keys: string; does: string };

const BROWSE: Row[] = [
  { pad: ["✛"], keys: "Arrows", does: "Move" },
  { pad: ["A"], keys: "Enter", does: "Open / select" },
  { pad: ["B"], keys: "Esc", does: "Back" },
  { pad: ["Y"], keys: "Delete", does: "Remove from Continue watching" },
  { pad: ["LB", "RB"], keys: "", does: "Previous / next season" },
  { pad: [], keys: "Home · End", does: "Start / end of row" },
  { pad: [], keys: "PgUp · PgDn", does: "Jump rows" },
  { pad: ["☰"], keys: "", does: "This help" },
];

const PLAYBACK: Row[] = [
  { pad: ["A"], keys: "", does: "Play / pause" },
  { pad: ["◀", "▶"], keys: "", does: "Back / forward 10 s" },
  { pad: ["LB", "RB"], keys: "", does: "Back / forward 30 s" },
  { pad: ["Y"], keys: "", does: "Next episode" },
  { pad: ["B"], keys: "Esc", does: "Back to the title" },
  { pad: ["☰"], keys: "", does: "Show the top bar" },
];

const Glyph = ({ g }: { g: string }) => <span className={g.length === 1 ? glyphs.circle : glyphs.pill}>{g}</span>;

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.h3}>{title}</h3>
      <dl className={styles.list}>
        {rows.map((r) => (
          <div key={r.does} className={styles.row}>
            <dt className={styles.inputs}>
              {r.pad.map((g) => (
                <Glyph key={g} g={g} />
              ))}
              {r.keys && <kbd className={styles.kbd}>{r.keys}</kbd>}
            </dt>
            <dd className={styles.does}>{r.does}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Header badge: a controller and a phone icon, green while connected. Opens the list of controls (so does the pad's Menu button). */
export function ControllerHelp() {
  const pad = usePadConnected();
  const phone = usePhoneConnected();
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = () => {
    const d = dialog.current;
    if (!d) return;
    if (d.open) d.close();
    else d.showModal();
  };
  useEffect(() => {
    addEventListener(HELP_EVENT, toggle);
    return () => removeEventListener(HELP_EVENT, toggle);
  }, []);

  return (
    <>
      <button
        type="button"
        className={styles.chip}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-label={`Controls. ${pad ? "Controller connected" : "No controller"}, ${phone ? "phone remote connected" : "no phone remote"}.`}
      >
        <svg className={pad ? styles.on : ""} aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <title>{pad ? "Controller connected" : "No controller"}</title>
          <path d="M6.5 7h11a4 4 0 0 1 3.9 4.9l-1.2 5.2a2.2 2.2 0 0 1-3.9.9L14.5 16h-5l-1.8 2a2.2 2.2 0 0 1-3.9-.9l-1.2-5.2A4 4 0 0 1 6.5 7z" />
          <path d="M8 10v3M6.5 11.5h3" />
          <circle cx="15.5" cy="11" r="0.6" fill="currentColor" />
          <circle cx="17.5" cy="13" r="0.6" fill="currentColor" />
        </svg>
        <svg className={phone ? styles.on : ""} aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <title>{phone ? "Phone remote connected" : "No phone remote"}</title>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M11 18.5h2" />
        </svg>
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="controls-title" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <div className={styles.head}>
          <h2 id="controls-title" className={styles.h2}>
            Controls
          </h2>
          <span className={styles.status}>
            {pad ? "Controller connected" : "No controller connected: plug one in or press any button"} ·{" "}
            {phone ? "Phone remote connected" : "No phone remote: open /remote on your phone"}
          </span>
        </div>
        <div className={styles.cols}>
          <Table title="Browsing" rows={BROWSE} />
          <Table title="While playing" rows={PLAYBACK} />
        </div>
        <form method="dialog">
          <button className={styles.close} autoFocus>
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
