-- Accounts. Each user has their own lists and progress, at most one paired TV and one signed-in phone.
-- Existing lists and progress belong to user 1, the owner (created with scripts/owner.ts).
create table users (
  id integer primary key,
  name text not null unique collate nocase,
  password_hash text not null,
  owner integer not null default 0,
  tv_session text,    -- SHA-256 of the paired TV's token; null = no TV
  phone_session text, -- SHA-256 of the signed-in phone's token; null = signed out
  paired_at integer,
  created_at integer not null
);

-- The owner's invite links (one live at a time). Only the token's hash is kept.
create table invites (token_hash text primary key, expires_at integer not null);

-- A TV waiting to be paired: it shows `code`, polls with `secret`, and `user_id` is set when a phone approves.
create table pairings (
  code text primary key,
  secret_hash text not null unique,
  expires_at integer not null,
  user_id integer
);

create table collection_new (
  user_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  title text not null,
  year text,
  poster_path text,
  status text not null check (status in ('to_watch', 'watched')),
  added_at integer not null,
  watched_at integer,
  favourite integer not null default 0,
  primary key (user_id, media_type, tmdb_id),
  check ((status = 'watched') = (watched_at is not null)),
  check (not favourite or status = 'watched')
);
insert into collection_new (user_id, media_type, tmdb_id, title, year, poster_path, status, added_at, watched_at, favourite)
  select 1, media_type, tmdb_id, title, year, poster_path, status, added_at, watched_at, favourite from collection;
drop table collection;
alter table collection_new rename to collection;

create table progress_new (
  user_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null,
  season integer,
  episode integer,
  position real not null,
  duration real not null,
  updated_at integer not null,
  hidden integer not null default 0
);
insert into progress_new (user_id, media_type, tmdb_id, season, episode, position, duration, updated_at, hidden)
  select 1, media_type, tmdb_id, season, episode, position, duration, updated_at, hidden from progress;
drop table progress;
alter table progress_new rename to progress;
create unique index progress_key on progress (user_id, media_type, tmdb_id, ifnull(season, -1), ifnull(episode, -1));
