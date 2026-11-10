// GET/POST /login: the password form, and the cookie once the password matches.
import { passwordMatches, sessionValue, setCookie } from "./session";

/** Where to go after login: same-site paths only (no `//host`, no backslash tricks). */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Self-contained (inline CSS, no assets) so it can be served before login. */
export const loginPage = (next: string, error = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Couch</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0e0e12; color: #f2f2f5; font: 20px system-ui, sans-serif; }
  form { display: grid; gap: 16px; width: min(90vw, 360px); }
  h1 { margin: 0; font-size: 32px; }
  input, button { font: inherit; padding: 14px 16px; border-radius: 12px; border: 2px solid #3a3a46; background: #1a1a22; color: inherit; }
  input:focus, button:focus { outline: none; border-color: #8ab4ff; }
  button { background: #8ab4ff; color: #0e0e12; font-weight: 600; cursor: pointer; }
  p { margin: 0; color: #ff8a8a; }
</style></head>
<body><form method="post" action="/login">
  <h1>Couch</h1>
  ${error ? "<p>Wrong password.</p>" : ""}
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <input type="hidden" name="next" value="${esc(next)}">
  <button type="submit">Sign in</button>
</form></body></html>`;

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export async function login(req: Request, url: URL, password: string): Promise<Response> {
  if (req.method !== "POST") return html(loginPage(safeNext(url.searchParams.get("next"))));
  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get("next")?.toString());
  if (!(await passwordMatches(form?.get("password")?.toString() ?? "", password))) return html(loginPage(next, true), 401);
  return new Response(null, { status: 303, headers: { location: next, "set-cookie": setCookie(await sessionValue(password), url.protocol === "https:") } });
}
