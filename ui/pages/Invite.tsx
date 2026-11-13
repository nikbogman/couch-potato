import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PageMessage } from "../components/Status";
import { cancelInvite, createInvite, shortDate } from "../lib/account";
import styles from "./Account.module.css";

/** Phone, owner only (designs: Phone · Invite a friend). Opening it makes a fresh link; the last one stops working. */
export function Invite() {
  const navigate = useNavigate();
  const invite = useQuery({ queryKey: ["invite"], queryFn: createInvite, staleTime: Infinity, gcTime: 0, retry: false });
  const cancel = useMutation({ mutationFn: cancelInvite, onSuccess: () => navigate("/remote/settings") });
  const [copied, setCopied] = useState(false);

  if (invite.isPending) return null;
  if (invite.isError) return <PageMessage>{invite.error.message}.</PageMessage>;
  const { url, expiresAt } = invite.data;
  const text = `Join me on couch potato: ${url}`;

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Invite a friend</h1>
      <p className={styles.lead}>Send this link. They pick a name and password on their phone and get their own lists, TV and remote. Nothing of yours is shared.</p>
      <div className={styles.section}>
        <span className={styles.label}>Invite link</span>
        <div className={styles.link}>
          <span>{url.replace(/^https?:\/\//, "")}</span>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(url).then(
                () => setCopied(true),
                () => {},
              )
            }
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className={styles.small}>Works once. Expires {shortDate(expiresAt)}.</p>
      </div>
      <div className={styles.actions}>
        {"share" in navigator && (
          <button type="button" className={styles.primary} onClick={() => navigator.share({ text }).catch(() => {})}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
            </svg>
            Share link
          </button>
        )}
        <button type="button" className={styles.secondary} disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          Cancel this invite
        </button>
      </div>
    </div>
  );
}
