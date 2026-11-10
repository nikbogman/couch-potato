-- Lists: one row per movie or series. Status and Favourite rules (from Popcorn's CONTEXT.md) are enforced here too.
create table collection (
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  title text not null,
  year text,
  poster_path text,
  status text not null check (status in ('to_watch', 'watched')),
  added_at integer not null,
  watched_at integer,
  favourite integer not null default 0,
  primary key (media_type, tmdb_id),
  check ((status = 'watched') = (watched_at is not null)),
  check (not favourite or status = 'watched')
);
