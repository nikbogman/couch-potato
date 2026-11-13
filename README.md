<div align="center">

<img src="ui/icons/icon.svg" width="88" alt="">

# couch potato

My monitor, turned into a TV: films, series and my lists in one ad-free app, run from my phone or a controller.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)
![D1](https://img.shields.io/badge/D1-F38020?logo=cloudflare&logoColor=white)
![Durable Objects](https://img.shields.io/badge/Durable_Objects-F38020?logo=cloudflare&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![TMDB](https://img.shields.io/badge/TMDB-01B4E4?logo=themoviedatabase&logoColor=white)

</div>

## Why I built it

I watch a lot of movies and series, and they were spread across **too many apps, each with its own ads and subscription**. I wanted **one app, with no ads, that's free**, and that **knows my lists**: what I want to watch, what I've watched and what I loved. I also live in a **small studio with one monitor that doubles as my TV**, so watching meant getting up from the couch to reach for the mouse. couch potato turns that monitor into a **TV I drive with a controller**, makes my **phone the remote** for searching and playback, and **remembers where I left off**, so I never have to leave the couch.

## How it works

![Architecture: TV and phone talk to one Cloudflare Worker, which serves the UI, talks to D1, relays TV and phone messages through a Durable Object, and proxies TMDB. Video plays in third-party iframes loaded by the TV.](docs/architecture.svg)

Everything runs on Cloudflare, within the free tier: one Worker, one D1 database and one Durable Object.

### The Worker <img src="https://cdn.simpleicons.org/cloudflareworkers/F38020" height="16" alt="">

A single [Hono](https://hono.dev) app handles every request, in this order:

1. **Accounts.** Every request resolves a session cookie to a user and a role: their **phone** (signed in with name and password at `/login`) or their **TV** (paired at `/pair`). Signed out, phones go to `/login`, everything else to `/pair`, and the API and WebSocket answer `401`. Account endpoints (`/api/me`, pairing, unpair, password, invites) live in `server/auth/`.
2. **`/ws`.** WebSocket upgrades go to the user's own relay Durable Object, with the role from the session (same-origin only).
3. **`/api/collection`.** The user's lists: read, add, mark watched, favourite.
4. **`/api/*`.** The TMDB proxy (search, trending, titles, seasons) and the user's watch progress. The TMDB key never leaves the server.
5. **Everything else.** Static assets: the React app and its icons.

The handler has no Cloudflare imports, so the whole server runs under `bun test` with in-memory fakes for D1, the assets binding and the relay.

### Accounts and pairing

I made my account with `scripts/owner.ts`; friends join through an invite link I make on my phone (Settings › Invite a friend), and get their own lists, TV and remote. Each account has **one TV and one phone**:

- **Phone:** name and password. Signing in on another phone signs the old one out.
- **TV:** nothing to type. The TV shows a QR code and a 6-character code; the phone scans it (or types the code) and approves. Pairing another TV signs the old one out; Unpair (on the TV or the phone) sends the TV back to the code.

A session is a random token; the user row keeps only its hash, one for the TV and one for the phone, so replacing a device revokes the old one. Sign-in, pairing and invites are rate limited per IP.

### The phone-to-TV relay <img src="https://cdn.simpleicons.org/cloudflare/F38020" height="16" alt="">

Each account has its own Durable Object, a room with one TV slot and one phone slot. A new connection in a slot closes the old one (close code 4001; 4002 when the TV is unpaired):

| From | Message | Effect |
|---|---|---|
| Phone | `play` | The TV opens the player for that title or episode |
| Phone | `command` | Play, pause, seek, fullscreen, next episode, switch player or stop on the TV |
| TV | `state` | What's playing now, sent to the phone and cached for when it joins later |
| Server | `presence` / `remotes` | The phone learns whether the TV is open; the TV learns whether its phone is connected |

The message types live in `shared/protocol.ts` and are checked on both sides.

### The database <img src="https://cdn.simpleicons.org/cloudflare/F38020" height="16" alt="">

D1 (SQLite) holds the accounts (`users`, `invites`, `pairings`) and, per user:

- **`collection`**: one row per title (`media_type` + `tmdb_id`), with its status, dates and favourite flag. The rules are enforced by the schema itself: a title is watched exactly when it has a watched date, and a favourite must be watched. Title, year and poster are copied from TMDB once, so lists load without calling TMDB.
- **`progress`**: position and duration per film or episode, updated as I watch.

Migrations are in `migrations/`.

### The TV and phone apps

One React 19 app serves both screens:

- **TV** (`/`): spatial navigation over real DOM focus, a Gamepad API loop for controllers, and focus following the mouse, so there is only ever one highlight.
- **Phone** (`/remote`): its own layout and tabs (Home, Lists, Remote, Explore). A phone opening the home page is sent here, and a home-screen shortcut opens it directly.

Data comes through TanStack Query. The player wraps the embed iframe, reads its progress events and saves progress back to the Worker.

## Run it locally

Notes for me, or an AI agent, to set it up again. It needs [Bun](https://bun.sh), a Cloudflare account and a free [TMDB API key](https://www.themoviedb.org/settings/api).

```sh
bun install
cp .dev.vars.example .dev.vars   # fill in TMDB_API_KEY
bun run build
npx wrangler d1 migrations apply couch-potato --local
bun scripts/owner.ts <my name>   # my account; asks for a password
bun run dev                      # serves on the local network, so the phone can reach it
```

Checks:

```sh
bun test
bun run typecheck
```

## Deploy to Cloudflare

```sh
npx wrangler d1 migrations apply couch-potato --remote
bun scripts/owner.ts <my name> --remote   # once; again to reset my password
npx wrangler secret put TMDB_API_KEY
bun run deploy
```

Then I sign in on my phone, open the Worker's URL on the monitor and scan its pairing code. Lists and progress from before accounts belong to my account (user 1).

## Notes

- Built for me and a few friends: accounts are by invite only, and only I can invite.
- The app doesn't host or store video. Playback comes from third-party embed players, and their availability is outside this app's control.
- Film and series data comes from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
