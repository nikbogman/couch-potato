import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PageMessage } from "../components/Status";
import { changePassword, fetchMe, shortDate, unpairTv } from "../lib/account";
import { useRemote } from "../remote/RemoteContext";
import styles from "./Account.module.css";

const icon = { "aria-hidden": true, width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const chevron = (
  <svg {...icon} width={18} height={18} stroke="var(--muted)">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

/** Phone Settings (designs: Phone · Settings): account, the paired TV, invites (owner), sign out. */
export function Settings() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const tv = useRemote()?.tv ?? false;
  const [password, setPassword] = useState(false);
  const unpair = useMutation({ mutationFn: unpairTv, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }) });

  if (me.isPending) return null;
  if (me.isError) return <PageMessage>Couldn&rsquo;t load your account.</PageMessage>;
  const { name, owner, pairedAt } = me.data;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Settings</h1>

      <section className={styles.card} aria-label="Account">
        <span className={styles.avatar} aria-hidden="true">
          {name[0]?.toUpperCase()}
        </span>
        <div className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.small}>{owner ? "Owner" : "Your own lists"}</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2>TV</h2>
        <div className={styles.group}>
          <div className={styles.row}>
            <svg {...icon} stroke="var(--text-soft)">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8" />
            </svg>
            <span className={styles.who}>
              {pairedAt ? "Paired TV" : "No TV paired"}
              {pairedAt && <span className={styles.small}>Since {shortDate(pairedAt)}</span>}
            </span>
            {pairedAt && (
              <span className={styles.status}>
                <span className={`${styles.dot} ${tv ? styles.on : ""}`} />
                {tv ? "Connected" : "Off"}
              </span>
            )}
          </div>
          <Link to="/remote/pair" className={styles.row}>
            <svg {...icon} stroke="var(--text-soft)">
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2M18 14h2v2M14 18h2v2h4" />
            </svg>
            <span>{pairedAt ? "Pair a different TV" : "Pair a TV"}</span>
            {chevron}
          </Link>
          {pairedAt && (
            <button
              type="button"
              className={`${styles.row} ${styles.danger}`}
              disabled={unpair.isPending}
              onClick={() => confirm("Unpair the TV? It signs out and shows a pairing code. Your lists are kept.") && unpair.mutate()}
            >
              <svg {...icon}>
                <path d="M9 7l-5 5 5 5M4 12h11M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
              </svg>
              <span>Unpair TV</span>
            </button>
          )}
        </div>
        {unpair.isError && <p className={styles.error}>{unpair.error.message}</p>}
      </section>

      <section className={styles.section}>
        <h2>Account</h2>
        <div className={styles.group}>
          {owner && (
            <Link to="/remote/invite" className={styles.row}>
              <svg {...icon} stroke="var(--text-soft)">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Invite a friend</span>
              {chevron}
            </Link>
          )}
          <button type="button" className={styles.row} aria-expanded={password} onClick={() => setPassword(!password)}>
            <svg {...icon} stroke="var(--text-soft)">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Change password</span>
          </button>
        </div>
        {password && <PasswordForm done={() => setPassword(false)} />}
      </section>

      <form method="post" action="/logout" className={styles.actions}>
        <button type="submit" className={styles.secondary}>
          Sign out of this phone
        </button>
        <p className={styles.small} style={{ textAlign: "center" }}>
          The TV stays paired. Sign in again to control it.
        </p>
      </form>
    </div>
  );
}

function PasswordForm({ done }: { done: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const save = useMutation({ mutationFn: () => changePassword(current, next), onSuccess: done });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.label}>
        Current password
        <input className={styles.input} type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className={styles.label}>
        New password
        <input className={styles.input} type="password" autoComplete="new-password" minLength={8} required value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      {save.isError && (
        <p className={styles.error} role="alert">
          {save.error.message}.
        </p>
      )}
      <button type="submit" className={styles.primary} disabled={save.isPending}>
        Save password
      </button>
    </form>
  );
}
