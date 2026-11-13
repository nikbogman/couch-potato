// Cookies. The session cookie is `<user id>.<token>` (see accounts.ts); the pairing cookie holds a waiting TV's secret.
export const SESSION = "couch_session";
export const PAIRING = "couch_pair";
const YEAR = 365 * 24 * 3600; // seconds; "long expiry", it's the user's own TV and phone

export function readCookie(header: string | null, name = SESSION): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
}

/** `secure` only over https, so `wrangler dev` on http://<lan-ip> (phone remote) still gets a cookie. Max-Age 0 clears it. */
export const setCookie = (value: string, secure: boolean, { name = SESSION, maxAge = YEAR } = {}) =>
  `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
