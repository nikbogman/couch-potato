import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchContinue, removeFromContinue } from "../lib/api";
import { Card } from "../components/Card";
import { ScrollRow } from "../components/ScrollRow";
import { Status } from "../components/Status";
import { useRemote, useBase } from "../remote/RemoteContext";
import { focusAndReveal } from "../navigation/spatial";
import { ListRow } from "./Lists";
import { UpNextHero } from "../components/UpNextHero";
import { APP_NAME, BrandMark } from "../components/Brand";
import { TvStatus } from "../components/TvStatus";
import row from "../components/Row.module.css";
import styles from "./Home.module.css";

export function Home() {
  const remote = useRemote();
  return (
    <div className={styles.page}>
      {remote && (
        // Phone screens start with their title (designs): here the app's name, with the TV status.
        <div className={styles.head}>
          <h1 className={styles.h1} translate="no">
            <BrandMark size={32} />
            {APP_NAME}
          </h1>
          <TvStatus />
        </div>
      )}
      {!remote && <UpNextHero />}
      <ContinueRow />
      <ListRow list="to_watch" hideEmpty />
    </div>
  );
}

/** Hidden while loading and on error: the row is a shortcut, not something to apologise for. Empty: a pointer to Explore. */
function ContinueRow() {
  const queryClient = useQueryClient();
  const base = useBase();
  const { data } = useQuery({ queryKey: ["progress", "continue"], queryFn: fetchContinue });
  const section = useRef<HTMLElement>(null);
  const refocus = useRef<number | null>(null); // index of the card being removed
  const remove = useMutation({
    mutationFn: removeFromContinue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", "continue"] }),
    onError: () => {
      refocus.current = null;
    },
  });
  // The removed card took focus with it. Land on its neighbour: the next card slides into its index, else the previous one,
  // else (row now empty and gone) the first card of the next row.
  useEffect(() => {
    const index = refocus.current;
    if (index === null) return;
    refocus.current = null;
    const cards = section.current?.querySelectorAll<HTMLElement>("a[href]");
    const to = cards?.length ? cards[Math.min(index, cards.length - 1)] : document.querySelector<HTMLElement>("main section a[href]");
    if (to) focusAndReveal(to);
  }, [data]);
  if (!data) return null;
  if (!data.length)
    return (
      <div className={row.status}>
        <Status>
          Nothing in progress. <Link to={`${base}/search`}>Find something in Explore</Link>
        </Status>
      </div>
    );
  return (
    <section ref={section} aria-label="Continue watching" >
      <h2 className={row.heading}>Continue watching</h2>
      <ScrollRow className={row.wide}>
        {data.map((r, i) => (
          <li key={`${r.mediaType}-${r.id}`} className={row.item}>
            <Card
              r={r}
              progress={r}
              onRemove={() => {
                refocus.current = i;
                remove.mutate(r);
              }}
            />
          </li>
        ))}
      </ScrollRow>
    </section>
  );
}
