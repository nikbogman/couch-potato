import { toggle, useChangeEntry, useEntry, type List, type MediaType } from "../lib/collection";
import { ListIcon } from "./ListBadge";
import { heroAction } from "./TitleHero";

const LABELS: Record<List, string> = { to_watch: "To watch", watched: "Watched", favourites: "Favourite" };

/**
 * To watch / Watched / Favourite for a title page: bare icons beside Play in each list's colour, filled when the title is in that list, outlined when not. `only` limits which show (TV Home's hero has Watched alone, labelled).
 * One save at a time: all are disabled while it runs. Hidden until the entry loads.
 */
export function ListToggles({ mediaType, id, only, labelled }: { mediaType: MediaType; id: number; only?: List[]; labelled?: boolean }) {
  const { data: entry, isError } = useEntry(mediaType, id);
  const change = useChangeEntry(mediaType, id);
  if (!entry) return isError ? <span className={heroAction.aside}>Lists unavailable</span> : null;
  const on = (l: List) => (l === "favourites" ? entry.favourite : entry.status === l);
  const showLabel = !!labelled; // icon-only next to Play, on the TV and the phone
  return (
    <>
      {(only ?? (["to_watch", "watched", "favourites"] as List[])).map((l) => (
        <button
          key={l}
          type="button"
          className={showLabel ? heroAction.toggle : heroAction.icon}
          aria-pressed={on(l)}
          aria-label={showLabel ? undefined : LABELS[l]}
          title={showLabel ? undefined : LABELS[l]}
          disabled={change.isPending}
          onClick={() => change.mutate(toggle(entry, l))}
        >
          {showLabel ? <ListIcon list={l} size={26} color="currentColor" filled={false} /> : <ListIcon list={l} size={40} filled={on(l)} />}
          {showLabel && LABELS[l]}
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
