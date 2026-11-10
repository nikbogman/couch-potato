import { useQuery } from "@tanstack/react-query";
import { fetchTrending } from "../lib/api";
import { Card } from "./Card";
import { ScrollRow } from "./ScrollRow";
import { LoadError, Status } from "./Status";
import styles from "./Row.module.css";

export function TrendingRow({ title, kind }: { title: string; kind: "movie" | "tv" }) {
  const { data, isError, refetch } = useQuery({ queryKey: ["trending", kind], queryFn: () => fetchTrending(kind) });
  return (
    <section aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      {isError ? (
        <div className={styles.status}>
          <LoadError what={title.toLowerCase()} retry={() => refetch()} />
        </div>
      ) : !data ? (
        <div className={styles.status}>
          <Status>Loading…</Status>
        </div>
      ) : (
        <ScrollRow>
          {data.map((r) => (
            <li key={r.id} className={styles.item}>
              <Card r={r} />
            </li>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}
