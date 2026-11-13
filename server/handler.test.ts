import { expect, test } from "bun:test";
import { createAccounts } from "./auth/accounts";
import { PASSWORD, signedIn } from "./auth/testAuth";
import { handle, type Env } from "./handler";
import { memoryD1 } from "./progress/testDb";

const tmdb = (async () => Response.json({ results: [{ media_type: "movie", id: 1, title: "Se7en" }] })) as unknown as typeof fetch;
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const LG_UA = "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/94.0 Safari/537.36";

/** Relay calls are recorded as `<user>:<path>?<query>`. */
function env(over: Partial<Env> = {}): Env & { relayed: string[] } {
  const relayed: string[] = [];
  return {
    TMDB_API_KEY: "KEY",
    DB: memoryD1(),
    ASSETS: { fetch: async () => new Response('<div id="root"></div>', { headers: { "content-type": "text/html" } }) },
    RELAY: { getByName: (name) => ({ fetch: async (r) => (relayed.push(`${name}:${new URL(r.url).pathname}${new URL(r.url).search}`), new Response("relay")) }) },
    relayed,
    ...over,
  };
}
const call = (e: Env, path: string, init: RequestInit = {}) => handle(new Request(`https://couch.test${path}`, init), e, tmdb);
const form = (body: Record<string, string>, cookie = ""): RequestInit => ({
  method: "POST",
  body: new URLSearchParams(body),
  headers: { "content-type": "application/x-www-form-urlencoded", cookie },
});
const cookieOf = (res: Response, name = "couch_session") =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(";")[0];
const page = { accept: "text/html" };

test("without a session: api and ws get 401, phones go to sign in, everything else to pairing", async () => {
  const e = env();
  expect((await call(e, "/api/search?q=x")).status).toBe(401);
  expect((await call(e, "/ws", { headers: { upgrade: "websocket" } })).status).toBe(401);
  const tv = await call(e, "/watch/movie/1", { headers: { "user-agent": LG_UA } });
  expect(tv.headers.get("location")).toBe("/pair");
  const phone = await call(e, "/", { headers: { "user-agent": PHONE_UA } });
  expect(phone.headers.get("location")).toBe("/login?next=%2F");
  expect((await call(e, "/remote/lists?x=1")).headers.get("location")).toBe("/login?next=%2Fremote%2Flists%3Fx%3D1");
  expect(e.relayed).toEqual([]);
});

test("sign in: wrong password is a 401 with no cookie; right password signs the phone in and closes the previous phone", async () => {
  const e = env();
  await createAccounts(e.DB).createUser("Nik", PASSWORD, true);
  const bad = await call(e, "/login", form({ name: "nik", password: "nope", next: "/remote" }));
  expect(bad.status).toBe(401);
  expect(bad.headers.get("set-cookie")).toBeNull();
  expect(await bad.text()).toContain("Wrong name or password");

  const first = await call(e, "/login", form({ name: "nik", password: PASSWORD, next: "/remote/lists" }));
  expect(first.status).toBe(303);
  expect(first.headers.get("location")).toBe("/remote/lists");
  const c = first.headers.get("set-cookie")!;
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age="]) expect(c).toContain(attr);
  expect(e.relayed).toEqual(["1:/kick?role=remote&code=4001"]);

  const second = await call(e, "/login", form({ name: "Nik", password: PASSWORD, next: "//evil.com" }));
  expect(second.headers.get("location")).toBe("/remote"); // can't redirect off-site
  expect((await call(e, "/api/me", { headers: { cookie: cookieOf(first)! } })).status).toBe(401); // one phone at a time
  expect(await (await call(e, "/api/me", { headers: { cookie: cookieOf(second)! } })).json()).toEqual({ name: "Nik", owner: true, role: "remote", pairedAt: null });
});

test("pairing: the TV shows a code, the phone approves it, the TV collects its session; a new TV replaces the old", async () => {
  const e = env();
  const phone = await signedIn(e.DB);

  async function pairTv() {
    const shown = await call(e, "/pair");
    expect(shown.status).toBe(200);
    const html = await shown.text();
    const code = html.match(/<strong translate="no">(\w{3}) (\w{3})<\/strong>/)!.slice(1).join("");
    expect(html).toContain("<svg"); // the QR code
    const pair = cookieOf(shown, "couch_pair")!;
    expect(await (await call(e, "/pair/status", { headers: { cookie: pair } })).json()).toEqual({ status: "pending" });
    expect((await call(e, "/pair", { headers: { cookie: pair } })).headers.getSetCookie()).toEqual([]); // a reload keeps the same code

    expect((await call(e, "/api/pair", { method: "POST", headers: { cookie: phone }, body: JSON.stringify({ code: "zzzzzz" }) })).status).toBe(404);
    const typed = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`; // forgiving about case and separators
    expect((await call(e, "/api/pair", { method: "POST", headers: { cookie: phone }, body: JSON.stringify({ code: typed }) })).status).toBe(204);
    expect((await call(e, "/api/pair", { method: "POST", headers: { cookie: phone }, body: JSON.stringify({ code }) })).status).toBe(404); // once

    const done = await call(e, "/pair/status", { headers: { cookie: pair } });
    expect(await done.json()).toEqual({ status: "paired" });
    expect((await call(e, "/pair/status", { headers: { cookie: pair } })).status).toBe(200);
    return cookieOf(done)!;
  }

  const tv = await pairTv();
  const me = await (await call(e, "/api/me", { headers: { cookie: tv } })).json();
  expect(me).toMatchObject({ name: "nik", role: "tv" });
  expect(me.pairedAt).toBeNumber();
  expect((await call(e, "/pair", { headers: { cookie: tv } })).headers.get("location")).toBe("/");

  e.relayed.length = 0;
  const newer = await pairTv();
  expect(e.relayed).toEqual(["1:/kick?role=tv&code=4001"]);
  expect((await call(e, "/api/me", { headers: { cookie: tv } })).status).toBe(401);
  expect((await call(e, "/api/me", { headers: { cookie: newer } })).status).toBe(200);
  expect((await call(e, "/api/me", { headers: { cookie: phone } })).status).toBe(200); // the phone stays signed in
});

test("only a phone approves pairing; an unknown pairing cookie is expired", async () => {
  const e = env();
  const tv = await signedIn(e.DB, { role: "tv" });
  expect((await call(e, "/api/pair", { method: "POST", headers: { cookie: tv }, body: '{"code":"ABCDEF"}' })).status).toBe(403);
  expect(await (await call(e, "/pair/status", { headers: { cookie: "couch_pair=nope" } })).json()).toEqual({ status: "expired" });
});

test("a phone session stays on /remote and a TV session off it, for page loads only", async () => {
  const e = env();
  const phone = await signedIn(e.DB);
  const tv = await signedIn(e.DB, { role: "tv" });
  expect((await call(e, "/movie/5", { headers: { cookie: phone, ...page } })).headers.get("location")).toBe("/remote");
  expect((await call(e, "/remote/lists", { headers: { cookie: tv, ...page } })).headers.get("location")).toBe("/");
  expect((await call(e, "/main.js", { headers: { cookie: phone } })).status).toBe(200);
  expect((await call(e, "/remote", { headers: { cookie: phone, ...page } })).status).toBe(200);
  expect((await call(e, "/", { headers: { cookie: tv, ...page } })).status).toBe(200);
});

test("/ws: goes to the user's own relay with the session's role; needs an upgrade and a same-origin Origin", async () => {
  const e = env();
  const phone = await signedIn(e.DB);
  const friend = await signedIn(e.DB, { name: "ana", role: "tv", owner: false });
  expect((await call(e, "/ws", { headers: { cookie: phone } })).status).toBe(426);
  expect((await call(e, "/ws", { headers: { cookie: phone, upgrade: "websocket", origin: "https://evil.example" } })).status).toBe(403);
  expect(await (await call(e, "/ws", { headers: { cookie: phone, upgrade: "websocket", origin: "https://couch.test" } })).text()).toBe("relay");
  await call(e, "/ws", { headers: { cookie: friend, upgrade: "websocket" } });
  expect(e.relayed).toEqual(["1:/ws?role=remote", "2:/ws?role=tv"]);
});

test("invites: owner only, single use, a taken name can try again; the friend gets their own lists", async () => {
  const e = env();
  const owner = await signedIn(e.DB);
  const invite = async () => (await (await call(e, "/api/invite", { method: "POST", headers: { cookie: owner } })).json()) as { url: string };
  const stale = await invite();
  const { url } = await invite(); // a new invite cancels the last
  expect(url).toMatch(/^https:\/\/couch\.test\/join\/[0-9a-f]{32}$/);
  const path = new URL(url).pathname;
  expect((await call(e, new URL(stale.url).pathname)).status).toBe(410);
  expect(await (await call(e, path)).text()).toContain("nik invited you");

  expect((await call(e, path, form({ name: "NIK", password: "long enough" }))).status).toBe(400); // taken (any case)
  expect((await call(e, path, form({ name: "ana", password: "short" }))).status).toBe(400);
  const joined = await call(e, path, form({ name: "ana", password: "long enough" }));
  expect(joined.headers.get("location")).toBe("/remote");
  const friend = cookieOf(joined)!;
  expect((await call(e, path, form({ name: "bo", password: "long enough" }))).status).toBe(410); // used up

  expect((await call(e, "/api/invite", { method: "POST", headers: { cookie: friend } })).status).toBe(403);
  expect(await (await call(e, "/api/me", { headers: { cookie: friend } })).json()).toMatchObject({ name: "ana", owner: false });

  await call(e, "/api/progress", { method: "POST", headers: { cookie: owner }, body: JSON.stringify({ mediaType: "movie", tmdbId: 5, position: 10, duration: 100 }) });
  expect(await (await call(e, "/api/progress?mediaType=movie&id=5", { headers: { cookie: friend } })).json()).toEqual({ progress: null });
  expect(await (await call(e, "/api/progress?mediaType=movie&id=5", { headers: { cookie: owner } })).json()).toMatchObject({ progress: { position: 10 } });

  await call(e, "/api/invite", { method: "DELETE", headers: { cookie: owner } });
  expect((await call(e, new URL((await invite()).url).pathname)).status).toBe(200);
});

test("log out and unpair revoke the right session and close the right socket", async () => {
  const e = env();
  const phone = await signedIn(e.DB);
  const tv = await signedIn(e.DB, { role: "tv" });

  const unpair = await call(e, "/api/unpair", { method: "POST", headers: { cookie: phone } });
  expect(unpair.status).toBe(204);
  expect(e.relayed.at(-1)).toBe("1:/kick?role=tv&code=4002");
  expect((await call(e, "/api/me", { headers: { cookie: tv } })).status).toBe(401);
  expect(await (await call(e, "/api/me", { headers: { cookie: phone } })).json()).toMatchObject({ pairedAt: null });

  const tv2 = await signedIn(e.DB, { role: "tv" });
  const tvOut = await call(e, "/logout", { method: "POST", headers: { cookie: tv2 } });
  expect(tvOut.headers.get("location")).toBe("/pair");
  expect(tvOut.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await call(e, "/api/me", { headers: { cookie: tv2 } })).status).toBe(401);

  const out = await call(e, "/logout", { method: "POST", headers: { cookie: phone } });
  expect(out.headers.get("location")).toBe("/login");
  expect((await call(e, "/api/me", { headers: { cookie: phone } })).status).toBe(401);
});

test("password change needs the current password", async () => {
  const e = env();
  const phone = await signedIn(e.DB);
  const change = (current: string, next: string) => call(e, "/api/password", { method: "POST", headers: { cookie: phone }, body: JSON.stringify({ current, next }) });
  expect((await change("wrong", "a new password")).status).toBe(400);
  expect((await change(PASSWORD, "short")).status).toBe(400);
  expect((await change(PASSWORD, "a new password")).status).toBe(204);
  expect((await call(e, "/login", form({ name: "nik", password: "a new password" }))).status).toBe(303);
});

test("rate limited: sign in, new pairing codes and approvals answer 429", async () => {
  const e = env({ LIMITER: { limit: async () => ({ success: false }) } });
  const phone = await signedIn(e.DB);
  expect((await call(e, "/login", form({ name: "nik", password: PASSWORD }))).status).toBe(429);
  expect((await call(e, "/pair")).status).toBe(429);
  expect((await call(e, "/api/pair", { method: "POST", headers: { cookie: phone }, body: '{"code":"ABCDEF"}' })).status).toBe(429);
});

test("forged and malformed session cookies are refused", async () => {
  const e = env();
  const phone = await signedIn(e.DB);
  const [, value] = phone.split("=");
  for (const bad of [`2.${value!.split(".")[1]}`, `${value!.slice(0, -2)}00`, "1.zz", "x", ""])
    expect((await call(e, "/api/me", { headers: { cookie: `couch_session=${bad}` } })).status).toBe(401);
});

test("api answers 503 when TMDB_API_KEY is missing", async () => {
  const e = env({ TMDB_API_KEY: undefined });
  const phone = await signedIn(e.DB);
  expect((await call(e, "/api/search?q=x", { headers: { cookie: phone } })).status).toBe(503);
  expect((await call(e, "/api/me", { headers: { cookie: phone } })).status).toBe(200); // the account works without TMDB
});

test("icons and the manifests are open without a session; nothing else is", async () => {
  const e = env();
  for (const path of ["/icon.svg", "/apple-touch-icon.png", "/manifest.webmanifest"]) expect((await call(e, path)).status).toBe(200);
  for (const path of ["/index.html", "/icon.svg/../index.html", "/icons/icon.svg"]) expect((await call(e, path)).status).toBe(303);
  expect(await (await call(e, "/remote.webmanifest")).json()).toMatchObject({ start_url: "/remote", scope: "/remote" });
});
