// The Worker's request handling as a Hono app, kept free of Cloudflare imports so it runs under `bun test` with fake bindings.
import { Hono } from "hono";
import { APP_NAME } from "../shared/brand";
import { createApi } from "./api";
import { createAccounts, type Role, type User } from "./auth/accounts";
import { accountRoute, publicRoute, type AuthDeps } from "./auth/routes";
import { readCookie } from "./auth/session";
import { collectionRoutes } from "./collection/routes";
import { createProgressStore, type D1Like } from "./progress/store";
import { createTmdb } from "./tmdb/client";

export type Env = {
  TMDB_API_KEY?: string;
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
  /** One relay Durable Object per user, by user id. */
  RELAY: { getByName(name: string): { fetch(req: Request): Promise<Response> } };
  /** Rate limit for sign-in, pairing and invites, per IP. Absent in tests and local dev without it. */
  LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
};

/** Served without a session: the sign-in pages and the OS (home-screen icon, manifest) fetch them before anyone signs in. */
const PUBLIC = new Set(["/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"]);

const json = (error: string, status: number) => Response.json({ error }, { status });

/** The phone's install manifest: a home-screen shortcut made from a /remote page opens the remote, not the TV screen. */
const REMOTE_MANIFEST = {
  name: `${APP_NAME} remote`,
  short_name: APP_NAME,
  id: "/remote",
  start_url: "/remote",
  scope: "/remote",
  display: "standalone",
  background_color: "#0b0c0e",
  theme_color: "#0b0c0e",
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

/** Phones sign in with a password; everything else (TVs, the desktop app, laptops) pairs. webOS says "SmartTV", not "Mobi". */
const isPhone = (ua: string | undefined) => /Mobi|iPhone/i.test(ua ?? "");
const isRemotePath = (path: string) => path === "/remote" || path.startsWith("/remote/");

/** `tmdbFetch` is injectable for tests. */
export function createApp(tmdbFetch?: typeof globalThis.fetch) {
  const app = new Hono<{ Bindings: Env; Variables: { user: User } }>();

  const deps = (env: Env): AuthDeps => ({
    accounts: createAccounts(env.DB),
    async kick(userId: number, role: Role, code: number) {
      await env.RELAY.getByName(String(userId)).fetch(new Request(`https://relay/kick?role=${role}&code=${code}`, { method: "POST" }));
    },
    async limited(req: Request) {
      if (!env.LIMITER) return false;
      return !(await env.LIMITER.limit({ key: req.headers.get("cf-connecting-ip") ?? "local" })).success;
    },
  });

  // Every request but the public files resolves its session. Pages and API are per user from here on.
  app.use(async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;
    if (path === "/remote.webmanifest") return Response.json(REMOTE_MANIFEST, { headers: { "content-type": "application/manifest+json" } });
    if (PUBLIC.has(path)) return c.env.ASSETS.fetch(c.req.raw);

    const d = deps(c.env);
    const user = await d.accounts.session(readCookie(c.req.header("cookie") ?? null));
    const open = await publicRoute(c.req.raw, url, d, user);
    if (open) return open;

    if (!user) {
      if (path === "/ws" || path.startsWith("/api/")) return json("Unauthorized", 401);
      if (isPhone(c.req.header("user-agent")) || isRemotePath(path)) return c.redirect(`/login?next=${encodeURIComponent(path + url.search)}`, 303);
      return c.redirect("/pair", 303);
    }

    const account = await accountRoute(c.req.raw, url, d, user);
    if (account) return account;

    // A phone session belongs on /remote and a TV session off it. Only page loads move; the bundle and API serve both.
    if (c.req.method === "GET" && c.req.header("accept")?.includes("text/html")) {
      if (user.role === "remote" && !isRemotePath(path)) return c.redirect("/remote", 303);
      if (user.role === "tv" && isRemotePath(path)) return c.redirect("/", 303);
    }
    c.set("user", user);
    await next();
  });

  app.all("/ws", async (c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("WebSocket upgrade required", 426);
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("Forbidden", 403);
    const user = c.get("user");
    return c.env.RELAY.getByName(String(user.id)).fetch(new Request(`https://relay/ws?role=${user.role}`, c.req.raw));
  });

  app.use("/api/*", async (c, next) => {
    if (!c.env.TMDB_API_KEY) return json("TMDB_API_KEY is not set", 503);
    await next();
  });

  const lists = (c: { env: Env; get(k: "user"): User; req: { raw: Request } }) =>
    collectionRoutes(c.env.DB, c.get("user").id, createTmdb(c.env.TMDB_API_KEY!, tmdbFetch)).fetch(c.req.raw);
  app.all("/api/collection/*", lists);
  app.all("/api/collection", lists);

  app.all("/api/*", (c) => createApi({ apiKey: c.env.TMDB_API_KEY!, fetch: tmdbFetch, progress: createProgressStore(c.env.DB, c.get("user").id) })(c.req.raw));

  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

const app = createApp();

export function handle(req: Request, env: Env, tmdbFetch?: typeof globalThis.fetch): Promise<Response> {
  return Promise.resolve((tmdbFetch ? createApp(tmdbFetch) : app).fetch(req, env));
}
