import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { searchTitles } from "../lib/api";
import { Card } from "../components/Card";
import { LoadError, Status } from "../components/Status";
import { TrendingRow } from "../components/TrendingRow";
import styles from "./Search.module.css";

const DEBOUNCE_MS = 300;

export function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [text, setText] = useState(q);

  // Back/forward changes the URL; pull the input along (a no-op while typing, since q lags text).
  useEffect(() => setText((t) => (t.trim() === q ? t : q)), [q]);

  // The URL is the source of truth for the query; typing updates it after a short pause.
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === q) return;
    const id = setTimeout(() => setParams(trimmed ? { q: trimmed } : {}, { replace: true }), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, q, setParams]);

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchTitles(q),
    enabled: q !== "",
    placeholderData: keepPreviousData,
  });
  const results = q ? data : undefined;

  return (
    <div className={styles.page}>
      <label htmlFor="q" className={styles.label}>
        Explore movies and series
      </label>
      <div className={styles.field}>
        <svg
          aria-hidden="true"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          enterKeyHint="search"
          placeholder="Dune, The Bear…"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={styles.input}
        />
      </div>
      {!q && (
        <div className={styles.explore}>
          <TrendingRow title="Trending movies" kind="movie" />
          <TrendingRow title="Trending TV" kind="tv" />
        </div>
      )}
      <SearchStatus q={q} count={results?.length} isError={isError} isFetching={isFetching} retry={() => refetch()} />
      {!isError && results && results.length > 0 && (
        <ul data-cards className={styles.grid}>
          {results.map((r) => (
            <li key={`${r.mediaType}-${r.id}`}>
              <Card r={r} badge />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchStatus(p: { q: string; count: number | undefined; isError: boolean; isFetching: boolean; retry: () => void }) {
  if (p.isError) return <LoadError what="results" retry={p.retry} />;
  if (!p.q) return null;
  if (p.count === undefined || p.isFetching) return <Status>Searching…</Status>;
  if (p.count === 0) return <Status>No results for &ldquo;{p.q}&rdquo;.</Status>;
  return (
    <Status>
      {p.count} result{p.count === 1 ? "" : "s"}
    </Status>
  );
}
