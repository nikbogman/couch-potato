import { toggle, useChangeEntry, useEntry, type List, type MediaType } from "../lib/collection";
import { heroAction } from "./TitleHero";

const BUTTONS: { list: List; label: string; icon: string }[] = [
  { list: "to_watch", label: "To watch", icon: "M12 5v14M5 12h14" },
  { list: "watched", label: "Watched", icon: "M5 12l5 5 9-10" },
  { list: "favourites", label: "Favourite", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
];

/** To watch / Watched / Favourite for a title page. One save at a time: all three are disabled while it runs. Hidden until the entry loads. */
export function ListToggles({ mediaType, id }: { mediaType: MediaType; id: number }) {
  const { data: entry, isError } = useEntry(mediaType, id);
  const change = useChangeEntry(mediaType, id);
  if (!entry) return isError ? <span className={heroAction.aside}>Lists unavailable</span> : null;
  const on = (l: List) => (l === "favourites" ? entry.favourite : entry.status === l);
  return (
    <>
      {BUTTONS.map((b) => (
        <button
          key={b.list}
          type="button"
          className={heroAction.toggle}
          aria-pressed={on(b.list)}
          disabled={change.isPending}
          onClick={() => change.mutate(toggle(entry, b.list))}
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill={b.list === "favourites" && on(b.list) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d={b.icon} />
          </svg>
          {b.label}
        </button>
      ))}
      {change.isError && (
        <span className={heroAction.aside} role="alert">
          Couldn&rsquo;t save. Try again.
        </span>
      )}
    </>
  );
}
