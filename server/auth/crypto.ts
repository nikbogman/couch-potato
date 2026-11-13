// Password hashing and random tokens, on WebCrypto only (Workers and Bun both have it).
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Workers caps PBKDF2 at 100k iterations. */
const ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256));
}

/** `pbkdf2$<iterations>$<salt>$<hash>`, so the iteration count can change without breaking stored hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomToken(16);
  return `pbkdf2$${ITERATIONS}$${salt}$${await pbkdf2(password, salt, ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !salt || !hash || !/^\d+$/.test(iter ?? "")) return false;
  return equal(await pbkdf2(password, salt, Number(iter)), hash);
}

/** Constant-time compare of two equal-length strings (hex digests here). */
export function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const randomToken = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)));

export const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/** No 0/O, 1/I: read off a TV across the room. 32 letters, so a byte maps without bias. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const pairingCode = () => [...crypto.getRandomValues(new Uint8Array(CODE_LENGTH))].map((b) => CODE_ALPHABET[b % 32]).join("");
/** What a person typed (spaces, dashes, lower case) as a code, or null. */
export const normalizeCode = (s: unknown) => {
  const c = typeof s === "string" ? s.toUpperCase().replace(/[\s-]/g, "") : "";
  return c.length === CODE_LENGTH && [...c].every((ch) => CODE_ALPHABET.includes(ch)) ? c : null;
};
