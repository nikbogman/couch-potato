// GET/POST /login: the password form, and the cookie once the password matches.
import { APP_NAME, MARK, markPaths } from "../../shared/brand";
import { passwordMatches, sessionValue, setCookie } from "./session";

/** Where to go after login: same-site paths only (no `//host`, no backslash tricks). */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])/.test(next) ? next : "/");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Self-contained (inline CSS, no assets) so it can be served before login. */
export const loginPage = (next: string, error = false) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${APP_NAME}</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>
  /* The app's tokens (ui/styles.css), inlined: this page is served before sign-in. */
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0b0c0e; color: #f4f4f5; font: 18px Inter, system-ui, sans-serif; }
  form { display: grid; gap: 16px; width: min(calc(100vw - 32px), 380px); }
  h1 { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
  h1 svg { flex: none; }
  input, button { font: inherit; height: 56px; padding: 0 18px; border-radius: 14px; border: 0; box-sizing: border-box; }
  input { background: #16181c; color: inherit; }
  input::placeholder { color: #9a9da4; }
  button { background: #f4f4f5; color: #0b0c0e; font-weight: 600; cursor: pointer; }
  input:focus-visible, button:focus-visible { outline: none; box-shadow: 0 0 0 4px #0b0c0e, 0 0 0 8px #f4f4f5; }
  p { margin: 0; color: #f28ab2; }
</style></head>
<body><form method="post" action="/login">
  <h1><svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7.2" fill="${MARK.ink}" stroke="rgb(255 255 255 / 0.12)" stroke-width="0.5"/><g transform="translate(4.08 4.08) scale(0.66)">${markPaths(MARK.amber, 2)}</g></svg>${APP_NAME}</h1>
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
