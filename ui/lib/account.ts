// The signed-in account: who it is, pairing a TV, password and invites (server/auth/routes.ts).

export type Me = { name: string; owner: boolean; role: "tv" | "remote"; pairedAt: number | null };

/** The server's `{ error }` message, or `fallback`. */
async function fail(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? fallback);
}

const post = (path: string, body?: unknown) =>
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/me");
  if (!res.ok) return fail(res, "Couldn't load your account");
  return (await res.json()) as Me;
}

/** Approve the TV showing `code`. Throws with a message to show. */
export async function approvePairing(code: string) {
  const res = await post("/api/pair", { code });
  if (!res.ok) return fail(res, "Couldn't pair the TV");
}

export async function unpairTv() {
  const res = await post("/api/unpair");
  if (!res.ok) return fail(res, "Couldn't unpair the TV");
}

export async function changePassword(current: string, next: string) {
  const res = await post("/api/password", { current, next });
  if (!res.ok) return fail(res, "Couldn't change the password");
}

export async function createInvite(): Promise<{ url: string; expiresAt: number }> {
  const res = await post("/api/invite");
  if (!res.ok) return fail(res, "Couldn't make an invite");
  return (await res.json()) as { url: string; expiresAt: number };
}

export async function cancelInvite() {
  const res = await fetch("/api/invite", { method: "DELETE" });
  if (!res.ok) return fail(res, "Couldn't cancel the invite");
}

/** "13 Nov" */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
