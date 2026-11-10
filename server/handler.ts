// The Worker's request handling as a Hono app, kept free of Cloudflare imports so it runs under `bun test` with fake bindings.
import { Hono } from "hono";
import { createApi } from "./api";
import { login } from "./auth/login";
import { readCookie, sessionValid } from "./auth/session";
import { collectionRoutes } from "./collection/routes";
import { createProgressStore, type D1Like } from "./progress/store";
import { createTmdb } from "./tmdb/client";

export type Env = {
  /** Secrets. Until COUCH_PASSWORD is set the Worker refuses everything. */
  COUCH_PASSWORD?: string;
  TMDB_API_KEY?: string;
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
  /** The single relay Durable Object namespace. */
  RELAY: { getByName(name: string): { fetch(req: Request): Promise<Response> } };
};

/** Served without the cookie: the login page and the OS (home-screen icon, manifest) fetch them before anyone signs in. */
const PUBLIC = new Set(["/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"]);

const json = (error: string, status: number) => Response.json({ error }, { status });

/** `tmdbFetch` is injectable for tests. */
export function createApp(tmdbFetch?: typeof globalThis.fetch) {
  const app = new Hono<{ Bindings: Env }>();

  // One password covers everything: the shell, the API, the relay.
  app.use(async (c, next) => {
    const password = c.env.COUCH_PASSWORD;
    if (!password) return c.text("Couch is locked: set the COUCH_PASSWORD secret (npx wrangler secret put COUCH_PASSWORD).", 503);
    const url = new URL(c.req.url);
    if (url.pathname === "/login") return login(c.req.raw, url, password);
    if (PUBLIC.has(url.pathname)) return c.env.ASSETS.fetch(c.req.raw);
    if (!(await sessionValid(readCookie(c.req.header("cookie") ?? null), password))) {
      if (url.pathname === "/ws" || url.pathname.startsWith("/api/")) return json("Unauthorized", 401);
      return c.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, 303);
    }
    await next();
  });

  app.all("/ws", async (c) => {
    if (c.req.header("upgrade") !== "websocket") return c.text("WebSocket upgrade required", 426);
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("Forbidden", 403);
    return c.env.RELAY.getByName("couch").fetch(c.req.raw);
  });

  app.use("/api/*", async (c, next) => {
    if (!c.env.TMDB_API_KEY) return json("TMDB_API_KEY is not set", 503);
    await next();
  });

  app.all("/api/collection/*", async (c) => collectionRoutes(c.env.DB, createTmdb(c.env.TMDB_API_KEY!, tmdbFetch)).fetch(c.req.raw));
  app.all("/api/collection", async (c) => collectionRoutes(c.env.DB, createTmdb(c.env.TMDB_API_KEY!, tmdbFetch)).fetch(c.req.raw));

  app.all("/api/*", (c) => createApi({ apiKey: c.env.TMDB_API_KEY!, fetch: tmdbFetch, progress: createProgressStore(c.env.DB) })(c.req.raw));

  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

const app = createApp();

export function handle(req: Request, env: Env, tmdbFetch?: typeof globalThis.fetch): Promise<Response> {
  return Promise.resolve((tmdbFetch ? createApp(tmdbFetch) : app).fetch(req, env));
}
