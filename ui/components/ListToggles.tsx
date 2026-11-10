import { toggle, useChangeEntry, useEntry, type List, type MediaType } from "../lib/collection";
import { useRemote } from "../remote/RemoteContext";
import { ListIcon } from "./ListBadge";
import { heroAction } from "./TitleHero";

const LABELS: Record<List, string> = { to_watch: "To watch", watched: "Watched", favourites: "Favourite" };

/**
 * To watch / Watched / Favourite for a title page. On the TV they are icon-only squares (designs: TV · Title, the heart);
 * on the phone, icon over label. `only` limits which show (TV Home's hero has Watched alone, labelled).
 * One save at a time: all are disabled while it runs. Hidden until the entry loads.
 */
export function ListToggles({ mediaType, id, only, labelled }: { mediaType: MediaType; id: number; only?: List[]; labelled?: boolean }) {
  const remote = useRemote();
  const { data: entry, isError } = useEntry(mediaType, id);
  const change = useChangeEntry(mediaType, id);
  if (!entry) return isError ? <span className={heroAction.aside}>Lists unavailable</span> : null;
  const on = (l: List) => (l === "favourites" ? entry.favourite : entry.status === l);
  const showLabel = labelled || !!remote;
  return (
    <>
      {(only ?? (["to_watch", "watched", "favourites"] as List[])).map((l) => (
        <button
          key={l}
          type="button"
          className={showLabel ? heroAction.toggle : heroAction.square}
          aria-pressed={on(l)}
          aria-label={showLabel ? undefined : LABELS[l]}
          title={showLabel ? undefined : LABELS[l]}
          disabled={change.isPending}
          onClick={() => change.mutate(toggle(entry, l))}
        >
          <ListIcon list={l} size={26} color="currentColor" />
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
