import { toggle, useChangeEntry, useEntry, type List, type MediaType } from "../lib/collection";
import { ListIcon } from "./ListBadge";
import { heroAction } from "./TitleHero";

const LABELS: Record<List, string> = { to_watch: "To watch", watched: "Watched", favourites: "Favourite" };

/**
 * To watch / Watched / Favourite for a title page: bare icons beside Play in each list's colour, filled when the title is in that list, outlined when not. `only` limits which show (TV Home's hero has Watched alone).
 * One save at a time: all are disabled while it runs. Hidden until the entry loads.
 */
export function ListToggles({ mediaType, id, only }: { mediaType: MediaType; id: number; only?: List[] }) {
  const { data: entry, isError } = useEntry(mediaType, id);
  const change = useChangeEntry(mediaType, id);
  if (!entry) return isError ? <span className={heroAction.aside}>Lists unavailable</span> : null;
  const on = (l: List) => (l === "favourites" ? entry.favourite : entry.status === l);
  return (
    <>
      {(only ?? (["to_watch", "watched", "favourites"] as List[])).map((l) => (
        <button
          key={l}
          type="button"
          className={heroAction.icon}
          aria-pressed={on(l)}
          aria-label={LABELS[l]}
          title={LABELS[l]}
          disabled={change.isPending}
          onClick={() => change.mutate(toggle(entry, l))}
        >
          <ListIcon list={l} size={40} filled={on(l)} />
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
