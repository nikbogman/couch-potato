import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { posterUrl } from "../lib/api";
import { LIST_LABELS, useList, type List, type ListItem } from "../lib/collection";
import { Card } from "../components/Card";
import { PlayButton } from "../components/PlayButton";
import { ScrollRow } from "../components/ScrollRow";
import { LoadError, Status } from "../components/Status";
import { useBase, useRemote } from "../remote/RemoteContext";
import row from "../components/Row.module.css";
import styles from "./Lists.module.css";

const LISTS: List[] = ["to_watch", "watched", "favourites"];
const FILTER_MS = 250;
const watchedOn = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const count = (n: number) => `${n} title${n === 1 ? "" : "s"}`;

/** TV: the three lists as rows. Phone: one list at a time. */
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

/** A list's first page as a row of poster cards (TV Home's To watch row too). Hidden while loading; empty says so. */
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

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function PhoneLists() {
  const [params, setParams] = useSearchParams();
  const list = LISTS.find((l) => l === params.get("list")) ?? "to_watch";
  const [text, setText] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);
  const title = useDebounced(text, FILTER_MS);
  const q = useList(list, { title, oldestFirst });
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

  const sortLabel = oldestFirst ? "Oldest first" : list === "to_watch" ? "Recently added" : "Last watched";
  return (
    <div className={styles.phone}>
      <h1 className={styles.h1}>My lists</h1>
      <div className={styles.segmented} role="tablist" aria-label="List">
        {LISTS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={l === list} onClick={() => setParams(l === "to_watch" ? {} : { list: l }, { replace: true })}>
            {LIST_LABELS[l]}
          </button>
        ))}
      </div>
      <label className={styles.filter}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <span className="sr-only">Filter by title</span>
        <input type="search" placeholder="Filter by title" autoComplete="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <section role="tabpanel" aria-label={LIST_LABELS[list]}>
        {q.isError ? (
          <LoadError what={LIST_LABELS[list]} retry={() => q.refetch()} />
        ) : !first ? (
          <Status>Loading…</Status>
        ) : (
          <>
            <div className={styles.count}>
              <span>{title.trim() ? `${first.matching} of ${count(first.total)}` : count(first.total)}</span>
              <button type="button" onClick={() => setOldestFirst((o) => !o)} aria-label={`Sorted: ${sortLabel}. Change order`}>
                {sortLabel}
              </button>
            </div>
            {!items.length ? (
              <p className={styles.empty}>
                {title.trim() ? (
                  <>No titles match &ldquo;{title.trim()}&rdquo;.</>
                ) : (
                  <>
                    Nothing here yet. <Link to="/remote/search">Find something in Explore</Link>
                  </>
                )}
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
          </>
        )}
      </section>
    </div>
  );
}

function ListRowItem({ r, list }: { r: ListItem; list: List }) {
  const meta = list === "watched" && r.watchedAt ? `Watched ${watchedOn.format(r.watchedAt)}` : [r.year, r.mediaType === "tv" ? "Series" : null].filter(Boolean).join(" · ");
  return (
    <li className={styles.item}>
      <Link to={`/remote/${r.mediaType}/${r.id}`} className={styles.open}>
        {r.posterPath ? <img className={styles.poster} src={posterUrl(r.posterPath)} alt="" width={48} height={72} loading="lazy" /> : <span className={styles.poster} aria-hidden="true" />}
        <span className={styles.grow}>
          <strong>{r.title}</strong>
          <span>{meta}</span>
        </span>
      </Link>
      {list === "to_watch" && r.mediaType === "movie" && (
        <PlayButton target={{ mediaType: "movie", id: r.id }} className={styles.play} remoteLabel={<PlayIcon title={r.title} />}>
          <PlayIcon title={r.title} />
        </PlayButton>
      )}
    </li>
  );
}

const PlayIcon = ({ title }: { title: string }) => (
  <svg role="img" aria-label={`Play ${title} on TV`} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4l13 8-13 8z" />
  </svg>
);
