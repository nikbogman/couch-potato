import type { CSSProperties } from "react";
import { toggle, useChangeEntry, useEntry, type List, type MediaType } from "../lib/collection";
import { ListIcon, listColor } from "./ListBadge";
import { heroAction } from "./TitleHero";

const BUTTONS: { list: List; label: string }[] = [
  { list: "to_watch", label: "To watch" },
  { list: "watched", label: "Watched" },
  { list: "favourites", label: "Favourite" },
];

/**
 * To watch / Watched / Favourite for a title page, in each list's icon and colour; an "on" button fills with its colour.
 * One save at a time: all three are disabled while it runs. Hidden until the entry loads.
 */
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
          style={{ "--c": listColor(b.list) } as CSSProperties}
          aria-pressed={on(b.list)}
          disabled={change.isPending}
          onClick={() => change.mutate(toggle(entry, b.list))}
        >
          <ListIcon list={b.list} size={22} color={on(b.list) ? "var(--ink)" : listColor(b.list)} />
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
