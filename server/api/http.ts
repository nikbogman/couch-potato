import type { ProgressStore } from "../progress/store";
import type { Tmdb } from "../tmdb/client";

/** What every route handler gets. */
export type Ctx = {
  tmdb: Tmdb;
  progress: ProgressStore;
  /** Today as YYYY-MM-DD: episodes aired on or before it count. */
  today: () => string;
};

/** TMDB's average vote to one decimal ("8.4"), or null when nobody has voted. */
export const rating = (v: number | undefined) => (v ? v.toFixed(1) : null);

// Errors carry no URLs or details: the TMDB url carries the key.
export const fail = (status: number, error: string) => Response.json({ error }, { status });
export const noContent = () => new Response(null, { status: 204 });
export const notFound = () => fail(404, "Not found");

/** A status thrown by the TMDB client, as a response. */
export const tmdbError = (status: unknown) => (status === 404 ? notFound() : fail(502, "TMDB request failed"));
