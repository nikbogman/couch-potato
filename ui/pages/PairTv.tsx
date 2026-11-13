import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { approvePairing, fetchMe, shortDate } from "../lib/account";
import styles from "./Account.module.css";

const CODE = /^[A-Z2-9]{6}$/;
const clean = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");
const spaced = (c: string) => `${c.slice(0, 3)} ${c.slice(3)}`;

const tvIcon = (
  <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
  </svg>
);

/**
 * Phone: pair a TV (designs: Phone · Pair a TV, Approve TV). The TV's QR code opens this page with `?code=`;
 * without one, the code is typed. Then the phone shows the code to check against the TV, and Approve.
 */
export function PairTv() {
  const [params, setParams] = useSearchParams();
  const code = clean(params.get("code") ?? "");
  return CODE.test(code) ? <Approve code={code} /> : <EnterCode typed={(c) => setParams({ code: c })} />;
}

function EnterCode({ typed }: { typed: (code: string) => void }) {
  const [value, setValue] = useState("");
  const code = clean(value);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (CODE.test(code)) typed(code);
  };
  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Pair a TV</h1>
      <p className={styles.lead}>Open couch potato on the TV. It shows a code: scan it with your camera, or type it here.</p>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.label}>
          Code on the TV
          <input
            className={`${styles.input} ${styles.code}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={8}
            required
            autoFocus
          />
        </label>
        <button type="submit" className={styles.primary} disabled={!CODE.test(code)}>
          Next
        </button>
      </form>
      <p className={styles.small}>One TV per account. Pairing a new one signs out the TV you use now.</p>
    </div>
  );
}

function Approve({ code }: { code: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const approve = useMutation({ mutationFn: () => approvePairing(code), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }) });

  if (approve.isSuccess)
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <span className={styles.badge} style={{ borderRadius: 999, color: "var(--ok)" }}>
            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
          <h1 className={styles.h1}>TV paired</h1>
          <p className={styles.lead}>It&rsquo;s opening your home now.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/remote/now-playing" className={styles.primary}>
            Open the remote
          </Link>
        </div>
      </div>
    );

  if (approve.isError)
    return (
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.h1}>That didn&rsquo;t work</h1>
          <p className={styles.lead} role="alert">
            {approve.error.message} On the TV, press OK for a new code, then scan again.
          </p>
        </div>
        <div className={styles.actions}>
          <Link to="/remote/pair" replace className={styles.secondary}>
            Type a code instead
          </Link>
        </div>
      </div>
    );

  const pairedAt = me.data?.pairedAt;
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.badge}>{tvIcon}</span>
        <h1 className={styles.h1}>Pair this TV?</h1>
        <p className={styles.lead}>It will show your lists, and this phone becomes its remote.</p>
      </div>
      <div className={styles.match}>
        <span>CHECK IT MATCHES THE TV</span>
        <strong translate="no">{spaced(code)}</strong>
      </div>
      {pairedAt && <p className={styles.small} style={{ textAlign: "center" }}>Your current TV (paired {shortDate(pairedAt)}) will be signed out.</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={approve.isPending} onClick={() => approve.mutate()}>
          Approve
        </button>
        <button type="button" className={styles.secondary} onClick={() => navigate("/remote")}>
          Cancel
        </button>
        {me.data && <p className={styles.small} style={{ textAlign: "center" }}>Signed in as {me.data.name}</p>}
      </div>
    </div>
  );
}
