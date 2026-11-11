<div align="center">

<img src="ui/icons/icon.svg" width="88" alt="">

# couch potato

**My own TV for a one-monitor studio.**<br>
I find something to watch, keep it on my lists, and play it on my monitor, all from the couch with my phone or a controller.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![D1](https://img.shields.io/badge/D1-F38020?logo=cloudflare&logoColor=white)
![Durable Objects](https://img.shields.io/badge/Durable_Objects-F38020?logo=cloudflare&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![TMDB](https://img.shields.io/badge/TMDB-01B4E4?logo=themoviedatabase&logoColor=white)

</div>

> [!NOTE]
> This is a personal project, built for me and my setup. It isn't meant for anyone else to use yet: there are no accounts, no onboarding and no support, and it's shaped around my habits.

## The problem

**Deciding what to watch was the worst part.** There are too many apps, each with its own ads, its own subscription and its own idea of what I should watch. None of them knew what I'd already seen or wanted to see, so most evenings started with a long scroll instead of a film.

**My lists lived somewhere else.** I kept what I want to watch, what I've watched and what I loved in a separate app (Popcorn). It had nothing to do with actually playing anything.

**My TV is my monitor.** I live in a small studio with one monitor, which is also my TV. Watching meant getting up from the couch to reach for the mouse and keyboard every time I wanted to search, pause or pick the next episode.

## My solution

couch potato is my answer to all three, in one app:

- **One place to decide, for free.** I browse trending films and series, search, and open title pages with seasons and episodes, with no ads or subscriptions. Video comes from free embed players.
- **My lists are built in.** To watch, Watched (with the date) and Favourites, for films and series. When I finish something, it's already where I'll look next. My old Popcorn lists were imported, so nothing was lost.
- **The monitor becomes a TV.** The interface is built for watching from across the room: big type, and one white focus ring that I move with a controller or the arrow keys. A mouse still works when I'm at the desk.
- **I never leave the couch.** My phone is the remote: search, lists, "play on TV", play/pause, seek, fullscreen, next episode, switch player and stop. Typing happens on the phone, not on the TV.
- **It remembers where I was.** Progress is saved while I watch, and Home opens on "Continue watching" and the next episode.
- **If a player fails, it moves on.** The default embed player falls back to the next one if a video doesn't start.
- **It's private.** One password protects everything: the app, the API and the phone-to-TV relay.

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
- **`progress`**: position and duration per film or episode, updated as I watch.

Migrations are in `migrations/`.

### The clients

One React 19 app serves both screens:

- **TV** (`/`): spatial navigation over real DOM focus, a Gamepad API loop for controllers, and focus following the mouse, so there is only ever one highlight.
- **Phone** (`/remote`): its own layout and tabs (Home, Lists, Remote, Explore). A phone opening the home page is sent here, and a home-screen shortcut opens it directly.

Data comes through TanStack Query. The player wraps the embed iframe, reads its progress events and saves progress back to the Worker.

## Run it

These are notes for myself, for setting it up again. You need [Bun](https://bun.sh), a Cloudflare account and a free [TMDB API key](https://www.themoviedb.org/settings/api).

```sh
bun install
cp .dev.vars.example .dev.vars   # fill in TMDB_API_KEY and COUCH_PASSWORD
bun run build
npx wrangler d1 migrations apply wt --local
bun run dev                      # serves on the local network, so the phone can reach it
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

Then I open the Worker's URL on the monitor, sign in, and open the same URL on my phone to get the remote.

## Notes

- Built for one person, me: there are no accounts, just the one password.
- The app doesn't host or store video. Playback comes from third-party embed players, and their availability is outside this app's control.
- Film and series data comes from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
