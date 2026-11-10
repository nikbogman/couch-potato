// TMDB response shapes, only the fields Couch reads.

export type TmdbItem = {
  media_type?: string;
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

export type TmdbMovie = {
  id: number;
  title?: string;
  release_date?: string;
  runtime?: number | null;
  genres?: { name: string }[];
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

export type TmdbTv = {
  id: number;
  name?: string;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  genres?: { name: string }[];
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  seasons?: { season_number: number; name?: string; episode_count?: number }[];
};

export type TmdbEpisode = {
  episode_number: number;
  name?: string;
  runtime?: number | null;
  overview?: string;
  still_path?: string | null;
  air_date?: string | null;
};
