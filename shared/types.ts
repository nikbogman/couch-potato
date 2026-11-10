/** A movie, or one episode of a series, by TMDB id: what gets played and what progress is saved against. */
export type Target = { mediaType: "movie"; id: string | number } | { mediaType: "tv"; id: string | number; season: number; episode: number };

/** The embedded players, in the order shown to the user as "Player 1", "Player 2"... */
export const PLAYER_IDS = ["playerone", "playertwo", "playerthree"] as const;
export type PlayerId = (typeof PLAYER_IDS)[number];
