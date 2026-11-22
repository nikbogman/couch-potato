import { useEffect, useId, useRef, useState } from "react";
import type { PadFamily } from "../navigation/gamepad";
import { usePad, usePadConnected, usePadFamily } from "../navigation/gamepadInput";
import { usePhoneConnected } from "../remote/TvClient";
import { PadGlyph, type PadButton } from "./PadGlyph";
import styles from "./ControllerHelp.module.css";

/** Fired by the controller's Menu button outside the player (see navigation/Navigation.tsx). */
export const HELP_EVENT = "couch:help";

type Row = { pad: PadButton[]; does: string; keys?: string };

const BROWSE: Row[] = [
  { pad: ["dpad"], does: "Move", keys: "Arrows" },
  { pad: ["a"], does: "Select", keys: "Enter" },
  { pad: ["b"], does: "Back", keys: "Esc" },
  { pad: ["y"], does: "Search", keys: "/" },
  { pad: ["x"], does: "Remove from Continue watching · episode watched", keys: "Delete" },
  { pad: ["lb", "rb"], does: "Previous / next tab · season" },
  { pad: ["lt", "rt"], does: "Page up / down", keys: "PgUp PgDn" },
  { pad: ["menu"], does: "Controls" },
];

const WATCH: Row[] = [
  { pad: ["a"], does: "Play / pause" },
  { pad: ["leftRight"], does: "Back / forward 10 s" },
  { pad: ["lt", "rt"], does: "Back / forward 30 s" },
  { pad: ["y"], does: "Next episode" },
  { pad: ["x"], does: "Switch player" },
  { pad: ["view"], does: "Full screen", keys: "F" },
  { pad: ["b"], does: "Leave fullscreen, then back", keys: "Esc" },
  { pad: ["menu"], does: "Show the player bar" },
];

const PHONE = (
  <>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </>
);
const PAD = (
  <>
    <path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 3.8a2.3 2.3 0 0 1-4 1L15 16H9l-2.1 1.8a2.3 2.3 0 0 1-4-1L2.1 13A5 5 0 0 1 7 7z" />
    <path d="M7 10.5v3M5.5 12h3" />
  </>
);
const Icon = ({ children, on, size = 24 }: { children: React.ReactNode; on: boolean; size?: number }) => (
  <svg className={on ? styles.on : ""} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

/** What's connected, in words: shared by the tooltip and the sheet. */
function status(phone: boolean, pad: boolean, family: PadFamily) {
  return {
    phone: phone ? { title: "Phone remote", sub: "Connected" } : { title: "No phone remote", sub: "Open couch potato on your phone" },
    pad: pad
      ? { title: family === "ps" ? "PlayStation controller" : "Controller", sub: family === "ps" ? "PlayStation buttons shown" : "Xbox buttons shown" }
      : { title: "No controller", sub: "Plug one in or press any button" },
  };
}

/**
 * Header devices button (designs: TV · Devices button and tooltip): phone and controller icons, green while connected,
 * with a tooltip saying what's connected. It, or the pad's Menu button, opens the Controls sheet (designs: TV · Controls sheet),
 * labelled for the connected pad; LB/RB (L1/R1) switch its Browsing / Watching tabs and B (○) closes it.
 */
export function ControllerHelp() {
  const pad = usePadConnected();
  const family = usePadFamily();
  const phone = usePhoneConnected();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"browse" | "watch">("browse");
  const tip = useId();
  const s = status(phone, pad, family);

  const toggle = () => {
    const d = dialog.current;
    if (!d) return;
    if (d.open) d.close();
    else {
      setTab("browse");
      d.showModal();
      setOpen(true);
    }
  };
  useEffect(() => {
    addEventListener(HELP_EVENT, toggle);
    return () => removeEventListener(HELP_EVENT, toggle);
  }, []);
  usePad((a) => (a === "lb" || a === "rb") && setTab(a === "lb" ? "browse" : "watch"), open);

  const rows = tab === "browse" ? BROWSE : WATCH;
  return (
    <>
      <span className={styles.anchor}>
        <button type="button" className={styles.chip} onClick={toggle} aria-haspopup="dialog" aria-label="Devices and controls" aria-describedby={tip}>
          <Icon on={phone}>{PHONE}</Icon>
          <Icon on={pad} size={28}>
            {PAD}
          </Icon>
        </button>
        <span id={tip} role="tooltip" className={styles.tooltip}>
          {[
            [phone, s.phone],
            [pad, s.pad],
          ].map(([on, d], i) => (
            <span key={i} className={styles.tipRow}>
              <span className={`${styles.dot} ${on ? styles.dotOn : ""}`} />
              <span className={styles.tipText}>
                <strong>{(d as { title: string }).title}</strong>
                <span>{(d as { sub: string }).sub}</span>
              </span>
            </span>
          ))}
        </span>
      </span>

      <dialog ref={dialog} className={styles.sheet} aria-labelledby="controls-title" onClose={() => setOpen(false)} onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <h2 id="controls-title" className={styles.h2}>
          Controls
        </h2>

        <div className={styles.devices}>
          <div className={styles.device}>
            <Icon on={false} size={30}>
              {PHONE}
            </Icon>
            <span className={styles.deviceText}>
              <strong>{s.phone.title}</strong>
              <span>{s.phone.sub}</span>
            </span>
            {phone && <span className={styles.connected}>Connected</span>}
          </div>
          <div className={styles.device}>
            <Icon on={false} size={30}>
              {PAD}
            </Icon>
            <span className={styles.deviceText}>
              <strong>{s.pad.title}</strong>
              <span>{s.pad.sub}</span>
            </span>
            {pad && <span className={styles.connected}>Connected</span>}
          </div>
        </div>

        <div className={styles.tabsRow}>
          <PadGlyph b="lb" family={family} />
          <div role="tablist" className={styles.tabs}>
            {(["browse", "watch"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={styles.tab} onClick={() => setTab(t)}>
                {t === "browse" ? "Browsing" : "Watching"}
              </button>
            ))}
          </div>
          <PadGlyph b="rb" family={family} />
        </div>

        <dl className={styles.list} role="tabpanel">
          {rows.map((r) => (
            <div key={r.does} className={styles.row}>
              <dt className={styles.inputs}>
                {r.pad.map((b) => (
                  <PadGlyph key={b} b={b} family={family} />
                ))}
              </dt>
              <dd className={styles.does}>{r.does}</dd>
              {r.keys ? <kbd className={styles.kbd}>{r.keys}</kbd> : <span />}
            </div>
          ))}
        </dl>

        <form method="dialog" className={styles.foot}>
          <button className={styles.close} autoFocus>
            <PadGlyph b="b" family={family} />
            Close
          </button>
          <span className={styles.hint}>
            <PadGlyph b="lb" family={family} />
            <PadGlyph b="rb" family={family} />
            Switch tab
          </span>
        </form>
      </dialog>
    </>
  );
}
