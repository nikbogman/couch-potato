create table progress (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  season integer,
  episode integer,
  position real not null,
  duration real not null,
  updated_at integer not null,
  hidden integer not null default 0
);
-- season/episode are null for movies, and nulls never collide in a plain unique index, hence ifnull.
create unique index progress_key
  on progress (media_type, tmdb_id, ifnull(season, -1), ifnull(episode, -1));
