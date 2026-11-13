import { useEffect, useRef, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { posterUrl } from "../lib/api";
import { addedAgo } from "../lib/added";
import { LIST_LABELS, useList, type List, type ListItem } from "../lib/collection";
import { Card } from "../components/Card";
import { ListIcon, listColor } from "../components/ListBadge";
import { ScrollRow } from "../components/ScrollRow";
import { LoadError, Status } from "../components/Status";
import { useBase, useRemote } from "../remote/RemoteContext";
import row from "../components/Row.module.css";
import styles from "./Lists.module.css";

const LISTS: List[] = ["to_watch", "watched", "favourites"];
/** What the counter squares say under their number (designs: Lists · 4). */
const COUNTED: Record<List, string> = { to_watch: "to go", watched: "seen", favourites: "loved" };
const watchedOn = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

/** TV: the three lists as rows. Phone: one list at a time under three counter squares. */
export function Lists() {
  return useRemote() ? <PhoneLists /> : <TvLists />;
}

function TvLists() {
  return (
    <div className={styles.tv}>
      {LISTS.map((l) => (
        <ListRow key={l} list={l} />
      ))}
    </div>
  );
}

/** A list's first page as a row of poster cards (TV Home's To watch row too), headed "To watch · 23". Empty says so. */
export function ListRow({ list, hideEmpty = false }: { list: List; hideEmpty?: boolean }) {
  const base = useBase();
  const { data, isError, refetch } = useList(list);
  const page = data?.pages[0];
  if (hideEmpty && (!page || !page.total)) return null;
  const title = LIST_LABELS[list];
  return (
    <section aria-label={title}>
      <h2 className={row.heading}>
        {title}
        {page ? ` · ${page.total}` : ""}
      </h2>
      {isError ? (
        <div className={row.status}>
          <LoadError what={title} retry={() => refetch()} />
        </div>
      ) : !page ? (
        <div className={row.status}>
          <Status>Loading…</Status>
        </div>
      ) : !page.items.length ? (
        <div className={row.status}>
          <Status>
            Nothing here yet. <Link to={`${base}/search`}>Find something in Explore</Link>
          </Status>
        </div>
      ) : (
        <ScrollRow>
          {page.items.map((r) => (
            <li key={`${r.mediaType}-${r.id}`} className={row.item}>
              <Card r={r} />
            </li>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}

/** One counter square: the list's icon and its size. The selected one fills with the list's colour. */
function Counter({ list, selected, onSelect }: { list: List; selected: boolean; onSelect: () => void }) {
  const total = useList(list).data?.pages[0]?.total;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={`${LIST_LABELS[list]}${total === undefined ? "" : `, ${total}`}`}
      className={styles.counter}
      style={{ "--c": listColor(list) } as CSSProperties}
      onClick={onSelect}
    >
      <ListIcon list={list} color={selected ? "var(--ink)" : listColor(list)} mark={selected ? listColor(list) : undefined} />
      <span className={styles.figure}>
        <span className={styles.number}>{total ?? "–"}</span>
        <span className={styles.what}>{COUNTED[list]}</span>
      </span>
    </button>
  );
}

function PhoneLists() {
  const [params, setParams] = useSearchParams();
  const list = LISTS.find((l) => l === params.get("list")) ?? "to_watch";
  // Newest first, no filter (designs: Lists · 4).
  const q = useList(list);
  const first = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinel = useRef<HTMLLIElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  // Infinite paging: the next page loads as the end of the list scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <div className={styles.phone}>
      <h1 className={styles.h1}>My lists</h1>
      <div className={styles.counters} role="tablist" aria-label="List">
        {LISTS.map((l) => (
          <Counter key={l} list={l} selected={l === list} onSelect={() => setParams(l === "to_watch" ? {} : { list: l }, { replace: true })} />
        ))}
      </div>
      <section role="tabpanel" aria-label={LIST_LABELS[list]}>
        {q.isError ? (
          <LoadError what={LIST_LABELS[list]} retry={() => q.refetch()} />
        ) : !first ? (
          <Status>Loading…</Status>
        ) : !items.length ? (
          <p className={styles.empty}>
            Nothing here yet. <Link to="/remote/search">Find something in Explore</Link>
          </p>
        ) : (
          <ul className={styles.list}>
            {items.map((r) => (
              <ListRowItem key={`${r.mediaType}-${r.id}`} r={r} list={list} />
            ))}
            {hasNextPage && (
              <li ref={sentinel} className={styles.more}>
                <Status>Loading more…</Status>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function rowMeta(r: ListItem, list: List) {
  if (list === "watched" && r.watchedAt) return `Watched ${watchedOn.format(r.watchedAt)}`;
  const kind = r.mediaType === "tv" ? "Series" : null;
  const when = list === "to_watch" ? `added ${addedAgo(r.addedAt)}` : null;
  return [r.year, kind, when].filter(Boolean).join(" · ");
}

/** Poster with the list's colour along its bottom edge, title, one line of meta. The whole row opens the title. */
function ListRowItem({ r, list }: { r: ListItem; list: List }) {
  return (
    <li className={styles.item}>
      <Link to={`/remote/${r.mediaType}/${r.id}`} className={styles.open}>
        <span className={styles.poster} style={{ "--c": listColor(list) } as CSSProperties}>
          {r.posterPath && <img src={posterUrl(r.posterPath)} alt="" width={48} height={72} loading="lazy" />}
        </span>
        <span className={styles.grow}>
          <strong>{r.title}</strong>
          <span>{rowMeta(r, list)}</span>
        </span>
      </Link>
    </li>
  );
}
