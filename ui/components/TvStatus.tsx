import { useRemote } from "../remote/RemoteContext";

/** Phone: a TV icon in a pill, green while a TV is open (icon only, no label). */
export function TvStatus() {
  const tv = useRemote()?.tv ?? false;
  return (
    <span
      role="img"
      aria-label={tv ? "TV connected" : "No TV"}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 999, background: "var(--surface)", flex: "none" }}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tv ? "var(--ok)" : "var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    </span>
  );
}
