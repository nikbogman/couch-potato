// One shared password (the COUCH_PASSWORD secret) and a signed cookie that proves it was entered. No accounts, no server-side sessions.
const COOKIE = "couch_session";
const MAX_AGE = 365 * 24 * 3600; // seconds; "long expiry", it's the user's own TV

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => (/^([0-9a-f]{2})+$/.test(s) ? Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16)) : null);
const hmacKey = (secret: string, usage: "sign" | "verify") =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

/** Constant-time string compare: both sides are hashed to equal length first, so neither content nor length leaks through timing. */
export async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([given, expected].map(async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < a!.length; i++) diff |= a![i]! ^ b![i]!;
  return diff === 0;
}

/** Cookie value `<expiry>.<hmac>`. The key is the password, so changing the password signs everyone out. */
export async function sessionValue(password: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + MAX_AGE;
  return `${exp}.${hex(await crypto.subtle.sign("HMAC", await hmacKey(password, "sign"), enc.encode(`couch:${exp}`)))}`;
}

export async function sessionValid(value: string | undefined, password: string, now = Date.now()): Promise<boolean> {
  const [exp, mac] = value?.split(".") ?? [];
  const sig = mac && unhex(mac);
  if (!exp || !/^\d+$/.test(exp) || !sig || Number(exp) * 1000 < now) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(password, "verify"), sig, enc.encode(`couch:${exp}`)); // constant-time
}

export function readCookie(header: string | null, name = COOKIE): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
}

/** `secure` only over https, so `wrangler dev` on http://<lan-ip> (phone remote) still gets a cookie. */
export const setCookie = (value: string, secure: boolean) =>
  `${COOKIE}=${value}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
