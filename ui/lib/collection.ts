// Client for /api/collection (server/collection): the To watch, Watched and Favourites lists.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SearchResult } from "./api";

export type MediaType = SearchResult["mediaType"];
export type Status = "to_watch" | "watched";
export type List = Status | "favourites";
export type Entry = { status: Status | null; favourite: boolean; watchedAt: number | null };
export type ListItem = SearchResult & { addedAt: number; watchedAt: number | null; favourite: boolean };
export type ListPage = { items: ListItem[]; total: number; matching: number; nextOffset: number | null };
export type Change = { status: Status | null } | { favourite: boolean };

export const LIST_LABELS: Record<List, string> = { to_watch: "To watch", watched: "Watched", favourites: "Favourites" };

export function listUrl(list: List, { title = "", oldestFirst = false, offset = 0 } = {}) {
  const q = new URLSearchParams({ list, order: oldestFirst ? "oldest" : "newest", offset: String(offset) });
  if (title.trim()) q.set("title", title.trim());
  return `/api/collection?${q}`;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`Couldn't ${what}`);
  return (await res.json()) as T;
}

export const fetchList = async (list: List, page: { title?: string; oldestFirst?: boolean; offset?: number } = {}) =>
  json<ListPage>(await fetch(listUrl(list, page)), "load the list");

export const fetchEntry = async (mediaType: MediaType, id: number | string) =>
  json<Entry>(await fetch(`/api/collection/${mediaType}/${id}`), "load the list status");

export async function changeEntry(mediaType: MediaType, id: number | string, change: Change) {
  const res = await fetch(`/api/collection/${mediaType}/${id}/${"status" in change ? "status" : "favourite"}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(change),
  });
  return json<Entry>(res, "save");
}

/** The three toggles' change: pressing the active one clears it (Watched clears to "not in lists", Favourite to just Watched). */
export function toggle(entry: Entry, pressed: List): Change {
  if (pressed === "favourites") return { favourite: !entry.favourite };
  return { status: entry.status === pressed ? null : pressed };
}

const KEY = ["collection"] as const;

export function useEntry(mediaType: MediaType, id: number | string) {
  return useQuery({ queryKey: [...KEY, "entry", mediaType, String(id)], queryFn: () => fetchEntry(mediaType, id) });
}

/** One mutation for all three toggles; every list refetches afterwards. */
export function useChangeEntry(mediaType: MediaType, id: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: Change) => changeEntry(mediaType, id, change),
    onSuccess: (entry) => {
      qc.setQueryData([...KEY, "entry", mediaType, String(id)], entry);
      return qc.invalidateQueries({ queryKey: [...KEY, "list"] });
    },
  });
}

export function useList(list: List, { title = "", oldestFirst = false } = {}) {
  return useInfiniteQuery({
    queryKey: [...KEY, "list", list, title.trim(), oldestFirst],
    queryFn: ({ pageParam }) => fetchList(list, { title, oldestFirst, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
}
