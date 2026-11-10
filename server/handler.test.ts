import { expect, test } from "bun:test";
import { handle, type Env } from "./handler";
import { memoryD1 } from "./progress/testDb";

const tmdb = (async () => Response.json({ results: [{ media_type: "movie", id: 1, title: "Se7en" }] })) as unknown as typeof fetch;

function env(over: Partial<Env> = {}): Env & { relayed: Request[] } {
  const relayed: Request[] = [];
  return {
    COUCH_PASSWORD: "pw",
    TMDB_API_KEY: "KEY",
    DB: memoryD1(),
    ASSETS: { fetch: async () => new Response("<div id=\"root\"></div>", { headers: { "content-type": "text/html" } }) },
    RELAY: { getByName: () => ({ fetch: async (r) => (relayed.push(r), new Response("relay")) }) },
    relayed,
    ...over,
  };
}
const call = (e: Env, path: string, init: RequestInit = {}) => handle(new Request(`https://couch.test${path}`, init), e, tmdb);
const form = (body: Record<string, string>): RequestInit => ({ method: "POST", body: new URLSearchParams(body), headers: { "content-type": "application/x-www-form-urlencoded" } });

async function login(e: Env, next = "/", password = "pw") {
  const res = await call(e, "/login", form({ password, next }));
  return { res, cookie: res.headers.get("set-cookie")!.split(";")[0]! };
}

test("everything is refused with 503 until COUCH_PASSWORD is set", async () => {
  for (const path of ["/", "/login", "/api/search?q=x", "/ws"]) {
    const res = await call(env({ COUCH_PASSWORD: undefined }), path);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("COUCH_PASSWORD");
  }
  expect((await call(env({ COUCH_PASSWORD: "" }), "/")).status).toBe(503);
});

test("without a session: api and ws get 401, the app shell redirects to the login page, the login page is open", async () => {
  const e = env();
  expect((await call(e, "/api/search?q=x")).status).toBe(401);
  expect((await call(e, "/api/progress", { method: "POST", body: "{}" })).status).toBe(401);
  expect((await call(e, "/ws", { headers: { upgrade: "websocket" } })).status).toBe(401);
  const shell = await call(e, "/watch/movie/1?t=5");
  expect(shell.status).toBe(303);
  expect(shell.headers.get("location")).toBe("/login?next=%2Fwatch%2Fmovie%2F1%3Ft%3D5");
  const page = await call(e, "/login?next=%2Fremote");
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('name="next" value="/remote"');
  expect(e.relayed).toEqual([]);
});

test("wrong password: 401, no cookie. Right password: redirect and a signed HttpOnly Secure SameSite=Lax cookie", async () => {
  const e = env();
  const bad = await call(e, "/login", form({ password: "nope", next: "/" }));
  expect(bad.status).toBe(401);
  expect(bad.headers.get("set-cookie")).toBeNull();
  expect(await bad.text()).toContain("Wrong password");

  const { res } = await login(e, "/remote");
  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/remote");
  const c = res.headers.get("set-cookie")!;
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age="]) expect(c).toContain(attr);
});

test("login can't redirect off-site", async () => {
  const { res } = await login(env(), "//evil.com");
  expect(res.headers.get("location")).toBe("/");
});

test("with the cookie: app shell, api and ws reach their backends; a forged or other-password cookie does not", async () => {
  const e = env();
  const { cookie } = await login(e);
  const headers = { cookie };
  expect((await call(e, "/movie/550", { headers })).status).toBe(200);
  expect(await (await call(e, "/api/search?q=sev", { headers })).json()).toMatchObject({ results: [{ id: 1, title: "Se7en" }] });
  await call(e, "/api/progress", { method: "POST", headers, body: JSON.stringify({ mediaType: "movie", tmdbId: 5, position: 10, duration: 100 }) });
  expect(await (await call(e, "/api/progress?mediaType=movie&id=5", { headers })).json()).toEqual({ progress: { position: 10, duration: 100, finished: false } });
  expect(await (await call(e, "/ws", { headers: { ...headers, upgrade: "websocket" } })).text()).toBe("relay");

  const other = (await login(env({ COUCH_PASSWORD: "other" }), "/", "other")).cookie;
  expect((await call(e, "/api/search?q=x", { headers: { cookie: other } })).status).toBe(401);
  expect((await call(e, "/api/search?q=x", { headers: { cookie: cookie.slice(0, -2) + "00" } })).status).toBe(401);
});

test("/ws: needs an upgrade and a same-origin Origin", async () => {
  const e = env();
  const { cookie } = await login(e);
  expect((await call(e, "/ws", { headers: { cookie } })).status).toBe(426);
  const up = { cookie, upgrade: "websocket" };
  expect((await call(e, "/ws", { headers: { ...up, origin: "https://evil.example" } })).status).toBe(403);
  expect((await call(e, "/ws", { headers: { ...up, origin: "https://couch.test" } })).status).toBe(200);
});

test("api answers 503 when TMDB_API_KEY is missing", async () => {
  const e = env({ TMDB_API_KEY: undefined });
  const { cookie } = await login(e);
  expect((await call(e, "/api/search?q=x", { headers: { cookie } })).status).toBe(503);
});

test("icons and the manifest are open without a session; nothing else is", async () => {
  const e = env();
  for (const path of ["/icon.svg", "/apple-touch-icon.png", "/manifest.webmanifest"]) expect((await call(e, path)).status).toBe(200);
  for (const path of ["/index.html", "/icon.svg/../index.html", "/icons/icon.svg"]) expect((await call(e, path)).status).toBe(303);
});

test("the phone's manifest is public and starts at /remote", async () => {
  const res = await call(env(), "/remote.webmanifest");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ start_url: "/remote", scope: "/remote" });
});
