// The pages served before sign-in: sign in (phone), pair (TV) and join (invite). Self-contained (inline CSS and script, no app bundle).
import { renderSVG } from "uqr";
import { APP_NAME, markSvg } from "../../shared/brand";
import { MIN_PASSWORD } from "./accounts";

/** Where to go after sign-in: same-site paths only (no `//host`, no backslash tricks). */
export const safeNext = (next: string | null | undefined, fallback = "/remote") => (next && /^\/(?![/\\])/.test(next) ? next : fallback);

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const mark = markSvg;

/** The app's tokens (ui/styles.css), inlined: these pages are served before sign-in. */
const BASE = `
  body { margin: 0; min-height: 100vh; background: #0b0c0e; color: #f4f4f5; font: 16px/1.5 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
  h1 { margin: 0; letter-spacing: -0.02em; }
  p { margin: 0; }
  a { color: #c9cbd0; }
  .muted { color: #9a9da4; }
  .notice { padding: 14px 16px; border-radius: 14px; background: #16181c; color: #c9cbd0; }
  .error { color: #f28ab2; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }`;

const page = (title: string, css: string, body: string, status = 200) =>
  new Response(
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>${BASE}${css}</style></head>
<body>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

/** Phone-sized form pages: sign in and join. */
const FORM_CSS = `
  main { box-sizing: border-box; min-height: 100vh; display: grid; place-items: center; padding: 48px 20px; }
  .col { display: grid; gap: 28px; width: min(100%, 380px); }
  .brand { display: grid; justify-items: center; gap: 16px; }
  .brand h1 { font-size: 28px; }
  .lead { display: grid; gap: 12px; }
  .lead h1 { font-size: 28px; line-height: 1.2; }
  .lead p { color: #c9cbd0; }
  form { display: grid; gap: 16px; }
  label { display: grid; gap: 8px; font-size: 14px; font-weight: 600; color: #c9cbd0; }
  label small { font-size: 14px; font-weight: 400; color: #9a9da4; }
  input, button { font: inherit; height: 52px; padding: 0 16px; border-radius: 14px; border: 0; box-sizing: border-box; }
  input { background: #16181c; color: inherit; font-weight: 400; }
  input[aria-invalid="true"] { box-shadow: inset 0 0 0 2px #f28ab2; }
  button { margin-top: 8px; background: #f4f4f5; color: #0b0c0e; font-weight: 600; cursor: pointer; }
  input:focus-visible, button:focus-visible { outline: none; box-shadow: 0 0 0 3px #0b0c0e, 0 0 0 6px #f4f4f5; }
  .foot { text-align: center; font-size: 14px; color: #9a9da4; }`;

export function loginPage({ next, name = "", error = false, replaced = false }: { next: string; name?: string; error?: boolean; replaced?: boolean }) {
  return page(
    APP_NAME,
    FORM_CSS,
    `<main><div class="col">
  <div class="brand">${mark(120)}<h1 class="sr-only">${APP_NAME}</h1></div>
  ${replaced ? `<p class="notice" role="status">You signed in on another phone, so this one was signed out. Your TV is still paired.</p>` : ""}
  <form method="post" action="/login">
    <label>Name<input name="name" value="${esc(name)}" autocomplete="username" autocapitalize="none" required ${name ? "" : "autofocus"}></label>
    <label>Password<input type="password" name="password" autocomplete="current-password" required ${error ? 'aria-invalid="true" aria-describedby="err"' : ""} ${name ? "autofocus" : ""}></label>
    ${error ? `<p id="err" class="error" role="alert">Wrong name or password.</p>` : ""}
    <input type="hidden" name="next" value="${esc(next)}">
    <button type="submit">Sign in</button>
  </form>
  <p class="foot">No account? Ask the owner for an invite link.<br>On a TV? <a href="/pair">Pair it with your phone</a>.</p>
</div></main>`,
    error ? 401 : 200,
  );
}

export function joinPage({ token, inviter, name = "", error }: { token: string; inviter: string; name?: string; error?: "taken" | "name" | "password" }) {
  const msg = { taken: "That name is taken. Pick another.", name: "Pick a name (up to 32 characters).", password: `Use at least ${MIN_PASSWORD} characters.` };
  return page(
    `Join ${APP_NAME}`,
    FORM_CSS,
    `<main><div class="col">
  <div class="lead">${mark(72)}<h1>${esc(inviter)} invited you to ${APP_NAME}</h1>
    <p>Pick a name and a password. You get your own lists, your own TV and your phone as its remote.</p></div>
  <form method="post" action="/join/${esc(token)}">
    <label>Name<input name="name" value="${esc(name)}" autocomplete="username" autocapitalize="none" maxlength="32" required autofocus ${error === "taken" || error === "name" ? 'aria-invalid="true"' : ""}></label>
    <label>Password<input type="password" name="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" required ${error === "password" ? 'aria-invalid="true"' : ""}><small>At least ${MIN_PASSWORD} characters.</small></label>
    ${error ? `<p class="error" role="alert">${msg[error]}</p>` : ""}
    <button type="submit">Create account</button>
  </form>
</div></main>`,
    error ? 400 : 200,
  );
}

export const inviteGonePage = () =>
  page(
    APP_NAME,
    FORM_CSS,
    `<main><div class="col"><div class="lead">${mark(72)}<h1>This invite has expired</h1><p>Invite links work once and last 7 days. Ask for a new one.</p></div></div></main>`,
    410,
  );

/** TV scale: read from the couch, driven by a remote (one button, focused). */
const PAIR_CSS = `
  body { font-size: 24px; overflow: hidden; }
  .brand { position: absolute; top: 48px; left: 96px; display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 700; }
  .banner { position: absolute; top: 44px; left: 50%; transform: translateX(-50%); padding: 14px 24px; border-radius: 999px; background: #16181c; color: #c9cbd0; font-size: 22px; white-space: nowrap; }
  main { box-sizing: border-box; min-height: 100vh; display: flex; align-items: center; justify-content: space-between; gap: 96px; padding: 160px 160px 120px 96px; }
  .how { display: grid; gap: 28px; max-width: 820px; }
  .eyebrow { font-size: 18px; font-weight: 600; letter-spacing: 0.14em; color: #f5b544; }
  .how h1 { font-size: 72px; line-height: 1.05; letter-spacing: -0.03em; }
  .how p { color: #c9cbd0; line-height: 1.55; max-width: 680px; }
  ol { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 22px; counter-reset: step; }
  li { display: flex; align-items: center; gap: 20px; font-size: 26px; counter-increment: step; }
  li::before { content: counter(step); flex: none; width: 48px; height: 48px; border-radius: 999px; background: #1f2227; display: grid; place-items: center; font-size: 22px; font-weight: 600; }
  .how .alt { font-size: 22px; color: #9a9da4; }
  .code { flex: none; display: grid; justify-items: center; gap: 28px; width: 560px; }
  .qr { position: relative; padding: 32px; border-radius: 24px; background: #f4f4f5; line-height: 0; }
  .qr svg { width: 350px; height: 350px; }
  .expired { position: absolute; inset: 0; border-radius: 24px; background: rgb(11 12 14 / 0.9); display: grid; place-content: center; justify-items: center; gap: 24px; line-height: 1.4; }
  .expired[hidden] { display: none; }
  .expired strong { font-size: 26px; }
  button { font: 600 24px Inter, system-ui, sans-serif; height: 64px; padding: 0 32px; border-radius: 16px; border: 0; background: #f4f4f5; color: #0b0c0e; cursor: pointer; }
  button:focus-visible, button:focus { outline: none; box-shadow: 0 0 0 4px #0b0c0e, 0 0 0 8px #f4f4f5; }
  .typed { display: grid; justify-items: center; gap: 8px; }
  .typed span { font-size: 18px; font-weight: 600; letter-spacing: 0.14em; color: #9a9da4; }
  .typed strong { font-size: 64px; letter-spacing: 0.16em; }
  .timer { width: 360px; display: grid; gap: 10px; justify-items: center; font-size: 20px; color: #9a9da4; }
  .bar { width: 100%; height: 6px; border-radius: 3px; background: #26292f; }
  .bar div { height: 100%; border-radius: 3px; background: #f5b544; }
  .status { position: absolute; left: 96px; bottom: 72px; display: flex; align-items: center; gap: 14px; font-size: 22px; color: #c9cbd0; }
  .status::before { content: ""; width: 12px; height: 12px; border-radius: 999px; background: #f5b544; }
  .phone { position: absolute; right: 96px; bottom: 72px; font-size: 18px; }`;

export function pairPage({ origin, code, msLeft, replaced }: { origin: string; code: string; msLeft: number; replaced: boolean }) {
  const qr = renderSVG(`${origin}/remote/pair?code=${code}`, { border: 0, blackColor: "#0b0c0e", whiteColor: "#f4f4f5" });
  const shown = `${code.slice(0, 3)} ${code.slice(3)}`;
  return page(
    `Pair this TV · ${APP_NAME}`,
    PAIR_CSS,
    `<div class="brand">${mark(88)}<span class="sr-only">${APP_NAME}</span></div>
${replaced ? `<p class="banner" role="status">Signed out: your account was paired with another TV.</p>` : ""}
<main>
  <div class="how">
    <span class="eyebrow">PAIR THIS TV</span>
    <h1>Sign in with your phone</h1>
    <p>Nothing to type here. The phone signs this TV in to your lists and becomes its remote.</p>
    <ol><li>Open ${APP_NAME} on your phone and sign in.</li><li>Point the phone camera at the code.</li><li>Tap Approve. This TV opens your home.</li></ol>
    <p class="alt">No camera? On the phone, open Settings › Pair a TV and type the code.</p>
  </div>
  <div class="code">
    <div class="qr" role="img" aria-label="QR code to pair this TV">${qr}
      <div class="expired" id="expired" hidden><strong>This code expired</strong><button type="button" id="renew">Get a new code</button></div>
    </div>
    <div class="typed"><span>OR TYPE</span><strong translate="no">${shown}</strong></div>
    <div class="timer"><div class="bar"><div id="bar"></div></div><span id="left" role="timer"></span></div>
  </div>
</main>
<p class="status" role="status" id="status">Waiting for your phone</p>
<a class="phone" href="/login">On a phone? Sign in</a>
<script>
  const end = Date.now() + ${Math.max(0, Math.round(msLeft))}, total = ${5 * 60_000};
  const $ = (id) => document.getElementById(id);
  let done = false;
  const expire = () => { done = true; $("expired").hidden = false; $("status").textContent = "Code expired"; $("renew").focus(); };
  $("renew").onclick = () => location.replace("/pair");
  const tick = () => {
    const ms = Math.max(0, end - Date.now()), s = Math.ceil(ms / 1000);
    $("bar").style.width = (ms / total) * 100 + "%";
    $("left").textContent = ms ? "New code in " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "Expired";
    if (!ms && !done) expire();
  };
  const poll = async () => {
    if (done) return;
    try {
      const r = await (await fetch("/pair/status", { cache: "no-store" })).json();
      if (r.status === "paired") return location.replace("/");
      if (r.status === "expired") return expire();
    } catch {}
    setTimeout(poll, 2000);
  };
  tick(); setInterval(tick, 1000); setTimeout(poll, 2000);
</script>`,
  );
}
