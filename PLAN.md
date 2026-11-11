# Plan: combine Couch and Popcorn into one app

For agents doing the work. "Working Title" is a placeholder name; don't bake it into identifiers (use `app` or `wt`).

## Status (2026-11-10)

Phases 1–9 done and deployed: https://couch-potato.nicola-manoilov.workers.dev (Worker `couch-potato`, D1 `wt`; Couch's Worker and D1 untouched).
- Collection uses Couch's raw-SQL D1 pattern (`server/collection/`), not Drizzle: same rules as Popcorn, one DB access style, tests on bun:sqlite.
- Player keeps its own band above the embed rather than an auto-hiding overlay, which would cover the embed's own controls.
- Not verified: a real TV, a real phone, a gamepad, signing in on production.
- Not done: tab focus-order tests (phase 3), phase 10 (share target, deferred by decision).

## Goal

One web app that does both jobs:
- **Couch** (`../couch`): browse TMDB, play titles in embed players on the TV, control playback from a phone or Xbox pad.
- **Popcorn** (`../popcorn`): keep lists of movies (To watch, Watched with date, Favourite) and identify movies from shared Instagram reels (stays in Popcorn, not ported).

The look is already designed: the HTML in this repo (`index.html`, `tv-*.html`, `phone-*.html`, `styles.css`) is the visual spec. Match it.

## Decisions already made

- **Base stack is Couch's client**: React 19, react-router, @tanstack/react-query, Bun build and `bun test`, plain CSS modules. Couch is already a web app for TV and phone; Popcorn's mobile app is React Native (Expo) and is **rewritten as DOM components**, not run through react-native-web.
- **One Bun + Hono backend on Cloudflare, one D1 database.** It holds Couch's API (TMDB proxy, watch progress, `/ws` relay Durable Object) and Popcorn's collection. Port the collection from Popcorn's old Hono server (`git -C ../popcorn show 4160257^:apps/server/...`, Drizzle on SQLite, so it maps to D1); don't rewrite it from scratch, and don't use Postgres.
- **The Instagram reels feature is not ported.** It stays in Popcorn. No Requests in this app for now.
- **One sign-in** (Couch's password cookie) covers the collection too. Drop Popcorn's bearer token.
- **Lists hold movies and series.** The collection is keyed by TMDB id plus media type.
- **Sharing (later, not in this plan):** a PWA `share_target`, Android only.
- **TV top tabs**: Home, Explore, My lists. No Movies or Series tabs.
- **Phone tabs**: Home, Lists, Remote, Explore.
- **List rows show year only.** No runtime, no genre (the design's runtime is ignored).
- **No data import** from Popcorn's Postgres; the collection starts empty.
- **The design's "From reels" section stays in the design files but isn't built.**
- **Player screen**: we only design our own layer around the embed `<iframe>` (header with back, title, player 1/2/3 switch, next episode, phone status; a toast for phone commands). The iframe's own controls are not ours.
- **Connection status**: a green phone icon only, no "Phone connected" text.
- **No controller hint strips or controls sheet in this phase.** The user tried them and reverted. Keep Couch's existing pad support and `ControllerHelp` working, just restyled.

## Open questions (ask the user before the phase that needs them)

1. **Final name.** Still open.

## Repo layout to reach

```
working-title/
  designs/            the current HTML/CSS/JS design files, moved here unchanged
  ui/                the React client (started from couch/src)
  shared/             from couch/shared (types, protocol, playback validation)
  server/, worker/    from couch; Hono backend, collection added
  PLAN.md, README.md
```

## Phases

Each phase is one PR-sized ticket. Finish with `bun test` and `bun run typecheck` green and the app running under `bun run dev`. Don't start the next phase on a red tree.

### 1. Scaffold from Couch
- Move the design files into `designs/` (fix their relative links).
- Copy `couch/` (client, `shared/`, `server/`, `worker/`, config, tests) into this repo; drop Couch's `.scratch/` and `HANDOVER.md`. Keep git history out; this is a fresh repo.
- Give the Worker a new name and its own D1 database in `wrangler.jsonc` so it can't overwrite the live Couch deploy.
- **Done when** the copied app runs locally and all of Couch's tests pass unchanged.

### 2. Design tokens and restyle
- Put the tokens from `designs/styles.css` (`:root`: ground, surface, raised, ink, ink-soft, muted, amber, live, ring) into `ui/styles.css`; Inter via Google Fonts.
- Restyle Couch's components to the designs: `TitleHero`, `Card`, `Row`/`ScrollRow`, `Status`, `TvLayout`, `RemoteLayout`, `NowPlayingBar`, `PadHints`, `ControllerHelp`.
- Focus is one style everywhere: white ring with a dark gap, 1.06 scale, `transform` only, off under `prefers-reduced-motion`.
- **Done when** TV Home and a title page match `designs/tv-home.html` and `designs/tv-title.html` side by side.

### 3. Navigation
- TV: top tabs Home, Explore, My lists (`TvLayout`). Search becomes part of Explore.
- Phone: bottom tab bar Home, Lists, Remote, Explore (`RemoteLayout`), safe-area aware.
- Keep spatial navigation (`ui/navigation/spatial.ts`) and gamepad input working across the new tabs; add tests for tab focus order.

### 4. Collection backend (Hono + D1)
- Port `collection/` (schema, logic, routes, tests) and the bits of `movies/` it needs from Popcorn's old Hono server (`git -C ../popcorn show 4160257^:apps/server/src/...`). Skip `reels/`, `csv/` and Popcorn's `auth/`.
- Drizzle with the `d1` driver; migrations under `drizzle/`, applied with `wrangler d1 migrations apply`.
- Key rows by `(tmdb_id, media_type)` so series fit.
- Mount the routes in Couch's backend behind its existing password cookie. If Couch's Worker isn't on Hono yet, move it onto Hono first (keep its tests green).
- Client: `ui/collection/` with react-query hooks against these routes.
- **Done when** the ported collection tests pass against local D1 (`wrangler dev`/miniflare) and the hooks are covered against a mocked fetch.

### 5. Phone Lists (`designs/phone-lists.html`)
- One screen with a segmented control To watch / Watched / Favourites, replacing Popcorn's three tabs and its `CollectionList`.
- Rows: poster 48×72, title, `year` (Watched: "Watched {date}" via `Intl.DateTimeFormat`), one Play on TV button that uses Couch's `PlayButton` remote path (disabled with no TV).
- Keep Popcorn's behaviour: title filter (debounced 250 ms), newest/oldest sort, infinite paging, empty state.

### 6. Explore (phone `designs/phone-explore.html`, TV equivalent)
- Search box: TMDB search (Couch's `/api/search`).
- Trending: Couch's `TrendingRow`.
- TV Explore: search plus trending rows only .

### 7. Title page and lists on the TV
- Add Popcorn's list toggles to Couch's `Movie` and series pages: the To watch, Watched and Favourite toggles (one mutation, all disabled while saving, toggling the active one clears it), plus Couch's Play/Resume.
- TV Home gains a "To watch" row from the collection; TV My lists shows the three lists as rows.

### 8. Player chrome (`designs/tv-playing.html`)
- Restyle `Player.tsx`'s own layer only: header that hides after 4 s of no input and shows on any key, pad button, pointer move or pause; player switch as a segmented group; toast for commands from the phone.
- **Don't touch** `ui/player/adapters.ts`, the embed URL builders, the startup status check or the fallback logic; they were tuned against real players. Run the existing player tests.

### 9. Phone remote (`designs/phone-remote.html`)
- Restyle `NowPlaying` and `NowPlayingBar`: still, title, progress with times, back 10 / play-pause / forward 10, Switch player, Next episode.

## Rules for agents

- Read the code you change and its tests first; reuse Couch's helpers before writing new ones.
- Never read or print secrets (`.dev.vars`, TMDB key, passwords). Don't deploy, push or create cloud resources without the user asking.
- Commit messages follow `../popcorn/COMMITS.md` style if unsure; small commits per phase.
- Report honestly what was verified (tests, local run) and what wasn't (real TV, real phone, production).
