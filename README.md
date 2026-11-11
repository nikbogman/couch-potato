<div align="center">

<img src="ui/icons/icon.svg" width="88" alt="">

# couch potato

**Your own streaming front end for the living room.**<br>
Find a film or series, keep it on a list, press play on the TV, and use your phone as the remote.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![D1](https://img.shields.io/badge/D1-F38020?logo=cloudflare&logoColor=white)
![Durable Objects](https://img.shields.io/badge/Durable_Objects-F38020?logo=cloudflare&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![TMDB](https://img.shields.io/badge/TMDB-01B4E4?logo=themoviedatabase&logoColor=white)

</div>

## The problem

Watching something at home used to take three tools and a lot of friction:

- **Deciding.** "What do we watch tonight?" means scrolling several apps, none of which knows what you've already seen or saved.
- **Remembering.** Lists of films to watch and films you loved live in a separate app (Popcorn), with no link to the TV.
- **Playing.** The TV side (Couch) could play a title, but typing on a TV with a remote or controller is slow, and the list wasn't there.

couch potato merges both apps into one: a single place that knows your lists and your progress, puts the film on the big screen, and lets your phone do the typing.

## What it does

- **Browse on the TV.** Trending films and series, search, title pages, seasons and episodes. Built for 10 feet: one white focus ring that a controller, keyboard or mouse moves.
- **Your lists.** To watch, Watched (with the date) and Favourites, for films and series. A favourite is always watched; unwatching removes the title.
- **Pick up where you left off.** Progress is saved while you watch. Home leads with "Continue watching" and the next episode.
- **Phone as remote.** Open the app on your phone and it becomes the remote: search, lists, "play on TV", play/pause, seek, fullscreen, next episode, switch player and stop.
- **Players with fallback.** Video comes from third-party embed players. If the default doesn't start, it falls back to the next one.
- **Private.** One password protects everything: the app, the API and the relay.

## Architecture

![Architecture: TV and phone talk to one Cloudflare Worker, which serves the UI, talks to D1, relays TV and phone messages through a Durable Object, and proxies TMDB. Video plays in third-party iframes loaded by the TV.](docs/architecture.svg)

Everything runs on Cloudflare, within the free tier: one Worker, one D1 database and one Durable Object.

### The Worker <img src="https://cdn.simpleicons.org/cloudflareworkers/F38020" height="16" alt="">

A single [Hono](https://hono.dev) app handles every request, in this order:

1. **Password gate.** The login page sets a signed session cookie. Without it, pages redirect to `/login`, and the API and WebSocket answer `401`.
2. **`/ws`.** WebSocket upgrades are handed to the relay Durable Object (same-origin only).
3. **`/api/collection`.** The lists: read, add, mark watched, favourite.
4. **`/api/*`.** The TMDB proxy (search, trending, titles, seasons) and watch progress. The TMDB key never leaves the server.
5. **Everything else.** Static assets: the React app and its icons.

The handler has no Cloudflare imports, so the whole server runs under `bun test` with in-memory fakes for D1, the assets binding and the relay.

### The relay <img src="https://cdn.simpleicons.org/cloudflare/F38020" height="16" alt="">

A single Durable Object holds one "room" in which TVs and phones meet over WebSocket:

| From | Message | Effect |
|---|---|---|
| Phone | `play` | The most recently active TV opens the player for that title or episode |
| Phone | `command` | Play, pause, seek, fullscreen, next episode, switch player or stop on that TV |
| TV | `state` | What's playing now, sent to every phone and cached for phones that join later |
| Server | `presence` / `remotes` | Phones learn whether a TV is open; TVs learn how many phones are connected |

The message types live in `shared/protocol.ts` and are checked on both sides.

### The database <img src="https://cdn.simpleicons.org/cloudflare/F38020" height="16" alt="">

D1 (SQLite) holds two tables:

- **`collection`**: one row per title (`media_type` + `tmdb_id`), with its status, dates and favourite flag. The rules are enforced by the schema itself: a title is watched exactly when it has a watched date, and a favourite must be watched. Title, year and poster are copied from TMDB once, so lists load without calling TMDB.
- **`progress`**: position and duration per film or episode, updated as you watch.

Migrations are in `migrations/`.

### The clients

One React 19 app serves both screens:

- **TV** (`/`): spatial navigation over real DOM focus, a Gamepad API loop for controllers, and focus following the mouse, so there is only ever one highlight.
- **Phone** (`/remote`): its own layout and tabs (Home, Lists, Remote, Explore). A phone opening the home page is sent here, and a home-screen shortcut opens it directly.

Data comes through TanStack Query. The player wraps the embed iframe, reads its progress events and saves progress back to the Worker.

## Run it

You need [Bun](https://bun.sh), a Cloudflare account and a free [TMDB API key](https://www.themoviedb.org/settings/api).

```sh
bun install
cp .dev.vars.example .dev.vars   # fill in TMDB_API_KEY and COUCH_PASSWORD
bun run build
npx wrangler d1 migrations apply wt --local
bun run dev                      # serves on your network, so the phone can reach it
```

Checks:

```sh
bun test
bun run typecheck
```

## Deploy

```sh
npx wrangler d1 migrations apply wt --remote
npx wrangler secret put COUCH_PASSWORD
npx wrangler secret put TMDB_API_KEY
bun run deploy
```

Then open the Worker's URL on the TV, sign in, and open the same URL on your phone to get the remote.

## Notes

- Built for one household: there are no accounts, just the one password.
- The app doesn't host or store video. Playback comes from third-party embed players, and their availability is outside this app's control.
- Film and series data comes from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
