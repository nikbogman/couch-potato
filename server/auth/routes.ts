// Sign-in, pairing, invites and the account API. Plain functions over the request: each returns a Response, or null if
// the path isn't theirs.
import { CLOSE } from "../../shared/protocol";
import { createAccounts, validName, validPassword, MIN_PASSWORD, PAIRING_MS, type Role, type Session, type User } from "./accounts";
import { normalizeCode } from "./crypto";
import { inviteGonePage, joinPage, loginPage, pairPage, safeNext } from "./pages";
import { PAIRING, readCookie, setCookie } from "./session";

export type AuthDeps = {
  accounts: ReturnType<typeof createAccounts>;
  /** Close the user's TV or phone socket in their relay room. */
  kick(userId: number, role: Role, code: number): Promise<void>;
  /** True when this caller has made too many attempts (rate limit). */
  limited(req: Request): Promise<boolean>;
};

const tooMany = () => new Response("Too many tries. Wait a minute and try again.", { status: 429 });
const redirect = (location: string, ...cookies: string[]) => {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 303, headers });
};
const json = (body: unknown, status = 200) => Response.json(body, { status });
const error = (message: string, status: number) => json({ error: message }, status);

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function form(req: Request) {
  const f = await req.formData().catch(() => null);
  return (k: string) => f?.get(k)?.toString() ?? "";
}

/** Pages and endpoints open without a session. `user` is whoever is signed in, if anyone. */
export async function publicRoute(req: Request, url: URL, deps: AuthDeps, user: User | null): Promise<Response | null> {
  const { accounts } = deps;
  const secure = url.protocol === "https:";
  const sessionCookie = (s: Session) => setCookie(s.cookie, secure);
  const path = url.pathname;

  if (path === "/login") {
    if (req.method !== "POST") {
      if (user) return redirect(user.role === "tv" ? "/" : safeNext(url.searchParams.get("next")));
      return loginPage({ next: safeNext(url.searchParams.get("next")), replaced: url.searchParams.has("replaced") });
    }
    if (await deps.limited(req)) return tooMany();
    const get = await form(req);
    const next = safeNext(get("next"));
    const session = await accounts.signIn(get("name"), get("password"));
    if (!session) return loginPage({ next, name: get("name"), error: true });
    await deps.kick(session.userId, "remote", CLOSE.replaced); // the previous phone, if any
    return redirect(next, sessionCookie(session));
  }

  if (path === "/pair") {
    if (user) return redirect(user.role === "tv" ? "/" : "/remote/pair");
    const replaced = url.searchParams.has("replaced");
    const secret = readCookie(req.headers.get("cookie"), PAIRING);
    const pending = await accounts.pairing(secret);
    if (pending) return pairPage({ origin: url.origin, code: pending.code, msLeft: pending.expiresAt - Date.now(), replaced });
    if (await deps.limited(req)) return tooMany();
    const p = await accounts.startPairing();
    const res = pairPage({ origin: url.origin, code: p.code, msLeft: PAIRING_MS, replaced });
    res.headers.append("set-cookie", setCookie(p.secret, secure, { name: PAIRING, maxAge: PAIRING_MS / 1000 }));
    return res;
  }

  if (path === "/pair/status") {
    const r = await accounts.collect(readCookie(req.headers.get("cookie"), PAIRING));
    if (typeof r === "string") return json({ status: r });
    await deps.kick(r.userId, "tv", CLOSE.replaced); // the previous TV, if any
    const res = json({ status: "paired" });
    res.headers.append("set-cookie", sessionCookie(r));
    res.headers.append("set-cookie", setCookie("", secure, { name: PAIRING, maxAge: 0 }));
    return res;
  }

  const join = path.match(/^\/join\/([0-9a-f]{32})$/);
  if (join) {
    const token = join[1]!;
    if (req.method !== "POST") return (await accounts.inviteValid(token)) ? joinPage({ token, inviter: await accounts.ownerName() }) : inviteGonePage();
    if (await deps.limited(req)) return tooMany();
    const get = await form(req);
    const name = validName(get("name"));
    const inviter = await accounts.ownerName();
    if (!name) return joinPage({ token, inviter, name: get("name"), error: "name" });
    if (!validPassword(get("password"))) return joinPage({ token, inviter, name, error: "password" });
    const r = await accounts.join(token, name, get("password"));
    if (r === "invalid") return inviteGonePage();
    if (r === "taken") return joinPage({ token, inviter, name, error: "taken" });
    return redirect("/remote", sessionCookie(r));
  }

  return null;
}

/** Account endpoints for a signed-in user. */
export async function accountRoute(req: Request, url: URL, deps: AuthDeps, user: User): Promise<Response | null> {
  const { accounts } = deps;
  const path = url.pathname;
  const post = req.method === "POST";

  if (path === "/logout" && post) {
    await accounts.signOut(user);
    return redirect(user.role === "tv" ? "/pair" : "/login", setCookie("", url.protocol === "https:", { maxAge: 0 }));
  }
  if (path === "/api/me") return json({ name: user.name, owner: user.owner, role: user.role, pairedAt: user.pairedAt });

  if (path === "/api/pair" && post) {
    if (user.role !== "remote") return error("Pair from your phone", 403);
    if (await deps.limited(req)) return error("Too many tries. Wait a minute.", 429);
    const code = normalizeCode((await body(req)).code);
    if (!code) return error("A code is 6 letters and numbers", 400);
    return (await accounts.approve(code, user.id)) ? new Response(null, { status: 204 }) : error("No TV is showing that code. Codes last 5 minutes.", 404);
  }

  if (path === "/api/unpair" && post) {
    await accounts.signOut({ id: user.id, role: "tv" });
    await deps.kick(user.id, "tv", CLOSE.signedOut);
    return new Response(null, { status: 204 });
  }

  if (path === "/api/password" && post) {
    if (await deps.limited(req)) return error("Too many tries. Wait a minute.", 429);
    const { current, next } = await body(req);
    if (!validPassword(next)) return error(`Use at least ${MIN_PASSWORD} characters`, 400);
    return (await accounts.setPassword(user.id, String(current ?? ""), next)) ? new Response(null, { status: 204 }) : error("Current password is wrong", 400);
  }

  if (path === "/api/invite" && (post || req.method === "DELETE")) {
    if (!user.owner) return error("Only the owner can invite", 403);
    if (!post) return (await accounts.cancelInvites(), new Response(null, { status: 204 }));
    const { token, expiresAt } = await accounts.createInvite();
    return json({ url: `${url.origin}/join/${token}`, expiresAt });
  }

  return null;
}
