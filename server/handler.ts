// The Worker's request handling, kept free of Cloudflare imports so it runs under `bun test` with fake bindings.
import { createApi } from "./api";
import { login } from "./auth/login";
import { readCookie, sessionValid } from "./auth/session";
import { createProgressStore, type D1Like } from "./progress/store";

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

export async function handle(req: Request, env: Env, tmdbFetch?: typeof globalThis.fetch): Promise<Response> {
  const password = env.COUCH_PASSWORD;
  if (!password) return new Response("Couch is locked: set the COUCH_PASSWORD secret (npx wrangler secret put COUCH_PASSWORD).", { status: 503 });

  const url = new URL(req.url);
  if (url.pathname === "/login") return login(req, url, password);
  if (PUBLIC.has(url.pathname)) return env.ASSETS.fetch(req);

  if (!(await sessionValid(readCookie(req.headers.get("cookie")), password))) {
    if (url.pathname === "/ws" || url.pathname.startsWith("/api/")) return json("Unauthorized", 401);
    return new Response(null, { status: 303, headers: { location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` } });
  }

  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade") !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== url.host) return new Response("Forbidden", { status: 403 });
    return env.RELAY.getByName("couch").fetch(req);
  }

  if (url.pathname.startsWith("/api/")) {
    if (!env.TMDB_API_KEY) return json("TMDB_API_KEY is not set", 503);
    return createApi({ apiKey: env.TMDB_API_KEY, fetch: tmdbFetch, progress: createProgressStore(env.DB) })(req);
  }

  return env.ASSETS.fetch(req);
}
