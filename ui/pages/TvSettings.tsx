import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { PageMessage } from "../components/Status";
import { fetchMe } from "../lib/account";
import { usePhoneConnected } from "../remote/TvClient";
import styles from "./TvSettings.module.css";

const icon = { "aria-hidden": true, width: 36, height: 36, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" } as const;

/** TV Settings (designs: TV · Settings and unpair): who's signed in, this TV and its phone, Unpair. */
export function TvSettings() {
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const phone = usePhoneConnected();
  const confirm = useRef<HTMLDialogElement>(null);

  if (me.isPending) return null;
  if (me.isError) return <PageMessage>Couldn&rsquo;t load your account.</PageMessage>;
  const { name, pairedAt } = me.data;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Settings</h1>

      <section className={styles.card} aria-label="Account">
        <span className={styles.avatar} aria-hidden="true">
          {name[0]?.toUpperCase()}
        </span>
        <div className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.muted}>Your lists and progress are showing on this TV.</span>
        </div>
      </section>

      <section className={styles.group} aria-label="Devices">
        <div className={styles.row}>
          <svg {...icon}>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8" />
          </svg>
          <div className={styles.text}>
            <span className={styles.label}>This TV</span>
            {pairedAt && (
              <span className={styles.muted}>Paired {new Date(pairedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
            )}
          </div>
        </div>
        <div className={styles.row}>
          <svg {...icon}>
            <rect x="7" y="2" width="10" height="20" rx="2" />
            <path d="M11 18h2" />
          </svg>
          <div className={styles.text}>
            <span className={styles.label}>Your phone</span>
            <span className={styles.muted}>The remote for this TV. Signing in on another phone replaces it.</span>
          </div>
          <span className={styles.status}>
            <span className={`${styles.dot} ${phone ? styles.on : ""}`} />
            {phone ? "Connected" : "Not connected"}
          </span>
        </div>
      </section>

      <div className={styles.action}>
        <button type="button" className={styles.button} onClick={() => confirm.current?.showModal()}>
          Unpair this TV
        </button>
        <span className={styles.muted}>Signs this TV out and shows the pairing code. To switch who&rsquo;s watching, pair it again from their phone.</span>
      </div>

      <dialog ref={confirm} className={styles.dialog} aria-labelledby="unpair-title">
        <h2 id="unpair-title">Unpair this TV?</h2>
        <p>{name}&rsquo;s lists will no longer show here and the phone stops controlling it. Your lists are kept.</p>
        <form method="post" action="/logout" className={styles.buttons}>
          <button type="button" className={styles.button} onClick={() => confirm.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} autoFocus>
            Unpair
          </button>
        </form>
      </dialog>
    </div>
  );
}
