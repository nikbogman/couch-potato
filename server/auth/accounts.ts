// Users, their sessions, invites and TV pairing, on D1. A session is `<user id>.<token>`; the user row keeps the SHA-256 of
// the one live TV token and the one live phone token, so signing in a new phone or pairing a new TV revokes the old one.
import type { D1Like } from "../progress/store";
import { hashPassword, pairingCode, randomToken, sha256, verifyPassword } from "./crypto";

export type Role = "tv" | "remote";
export type User = { id: number; name: string; owner: boolean; role: Role; pairedAt: number | null };
/** A new session: what goes in the cookie, and whose it is. */
export type Session = { userId: number; cookie: string };

export const PAIRING_MS = 5 * 60_000;
export const INVITE_MS = 7 * 24 * 3600_000;
export const MIN_PASSWORD = 8;
const MAX_NAME = 32;

type UserRow = { id: number; name: string; password_hash: string; owner: number; tv_session: string | null; phone_session: string | null; paired_at: number | null };

export const validName = (s: unknown): string | null => {
  const n = typeof s === "string" ? s.trim() : "";
  return n && n.length <= MAX_NAME ? n : null;
};
export const validPassword = (s: unknown): s is string => typeof s === "string" && s.length >= MIN_PASSWORD;

/** `now` is injectable for tests. */
export function createAccounts(db: D1Like, now: () => number = Date.now) {
  const column = (role: Role) => (role === "tv" ? "tv_session" : "phone_session");

  /** Rotates the role's token: the device holding the old one is signed out. */
  async function startSession(userId: number, role: Role): Promise<Session> {
    const token = randomToken();
    const pairedAt = role === "tv" ? ", paired_at = ?3" : "";
    await db.prepare(`update users set ${column(role)} = ?2${pairedAt} where id = ?1`).bind(userId, await sha256(token), ...(role === "tv" ? [now()] : [])).run();
    return { userId, cookie: `${userId}.${token}` };
  }

  async function createUser(name: string, password: string, owner = false): Promise<number | null> {
    const taken = await db.prepare("select 1 from users where name = ?1").bind(name).first();
    if (taken) return null;
    const row = await db
      .prepare("insert into users (name, password_hash, owner, created_at) values (?1, ?2, ?3, ?4) returning id")
      .bind(name, await hashPassword(password), owner ? 1 : 0, now())
      .first<{ id: number }>();
    return row?.id ?? null;
  }

  return {
    createUser,

    /** The user a session cookie belongs to, or null if it's malformed, revoked or unknown. */
    async session(cookie: string | undefined): Promise<User | null> {
      const [id, token] = cookie?.split(".") ?? [];
      if (!id || !/^\d+$/.test(id) || !token || !/^[0-9a-f]{64}$/.test(token)) return null;
      const r = await db.prepare("select * from users where id = ?1").bind(Number(id)).first<UserRow>();
      if (!r) return null;
      const h = await sha256(token);
      const role: Role | null = r.tv_session === h ? "tv" : r.phone_session === h ? "remote" : null;
      return role && { id: r.id, name: r.name, owner: !!r.owner, role, pairedAt: r.paired_at };
    },

    /** Phone sign-in. Null for a wrong name or password. */
    async signIn(name: string, password: string): Promise<Session | null> {
      const r = await db.prepare("select * from users where name = ?1").bind(name.trim()).first<UserRow>();
      if (!r || !(await verifyPassword(password, r.password_hash))) return null;
      return startSession(r.id, "remote");
    },

    async signOut(user: Pick<User, "id" | "role">) {
      await db.prepare(`update users set ${column(user.role)} = null${user.role === "tv" ? ", paired_at = null" : ""} where id = ?1`).bind(user.id).run();
    },

    async setPassword(userId: number, current: string, next: string): Promise<boolean> {
      const r = await db.prepare("select password_hash from users where id = ?1").bind(userId).first<{ password_hash: string }>();
      if (!r || !validPassword(next) || !(await verifyPassword(current, r.password_hash))) return false;
      await db.prepare("update users set password_hash = ?2 where id = ?1").bind(userId, await hashPassword(next)).run();
      return true;
    },

    /** A new invite token. One is live at a time: making one cancels the last. */
    async createInvite(): Promise<{ token: string; expiresAt: number }> {
      const token = randomToken(16);
      const expiresAt = now() + INVITE_MS;
      await db.prepare("delete from invites").bind().run();
      await db.prepare("insert into invites (token_hash, expires_at) values (?1, ?2)").bind(await sha256(token), expiresAt).run();
      return { token, expiresAt };
    },

    async cancelInvites() {
      await db.prepare("delete from invites").bind().run();
    },

    /** Who invites: the owner's name. */
    async ownerName(): Promise<string> {
      return (await db.prepare("select name from users where owner = 1 order by id limit 1").bind().first<{ name: string }>())?.name ?? "Someone";
    },

    async inviteValid(token: string): Promise<boolean> {
      return !!(await db.prepare("select 1 from invites where token_hash = ?1 and expires_at > ?2").bind(await sha256(token), now()).first());
    },

    /** Spends the invite on a new account and signs its phone in. */
    async join(token: string, name: string, password: string): Promise<Session | "invalid" | "taken"> {
      const used = await db.prepare("delete from invites where token_hash = ?1 and expires_at > ?2").bind(await sha256(token), now()).run();
      if (!used.meta.changes) return "invalid";
      const id = await createUser(name, password);
      if (id === null) {
        // Name taken: give the invite back so they can pick another name.
        await db.prepare("insert or ignore into invites (token_hash, expires_at) values (?1, ?2)").bind(await sha256(token), now() + INVITE_MS).run();
        return "taken";
      }
      return startSession(id, "remote");
    },

    /** A TV starts pairing: it shows `code` and keeps `secret` to poll with. */
    async startPairing(): Promise<{ code: string; secret: string; expiresAt: number }> {
      await db.prepare("delete from pairings where expires_at <= ?1").bind(now()).run();
      const secret = randomToken();
      const expiresAt = now() + PAIRING_MS;
      for (;;) {
        const code = pairingCode();
        const r = await db
          .prepare("insert or ignore into pairings (code, secret_hash, expires_at) values (?1, ?2, ?3)")
          .bind(code, await sha256(secret), expiresAt)
          .run();
        if (r.meta.changes) return { code, secret, expiresAt };
      }
    },

    /** The pending pairing a TV's secret refers to, if it hasn't expired. */
    async pairing(secret: string | undefined): Promise<{ code: string; expiresAt: number; userId: number | null } | null> {
      if (!secret) return null;
      const r = await db
        .prepare("select code, expires_at, user_id from pairings where secret_hash = ?1 and expires_at > ?2")
        .bind(await sha256(secret), now())
        .first<{ code: string; expires_at: number; user_id: number | null }>();
      return r && { code: r.code, expiresAt: r.expires_at, userId: r.user_id };
    },

    /** A signed-in phone approves the TV showing `code`. False if no TV is waiting with it. */
    async approve(code: string, userId: number): Promise<boolean> {
      const r = await db.prepare("update pairings set user_id = ?2 where code = ?1 and expires_at > ?3 and user_id is null").bind(code, userId, now()).run();
      return r.meta.changes > 0;
    },

    /** The TV collects its session once approved. The pairing is used up; the user's previous TV is signed out. */
    async collect(secret: string | undefined): Promise<Session | "pending" | "expired"> {
      if (!secret) return "expired";
      const h = await sha256(secret);
      const r = await db.prepare("delete from pairings where secret_hash = ?1 and user_id is not null and expires_at > ?2 returning user_id").bind(h, now()).first<{ user_id: number }>();
      if (r) return startSession(r.user_id, "tv");
      return (await db.prepare("select 1 from pairings where secret_hash = ?1 and expires_at > ?2").bind(h, now()).first()) ? "pending" : "expired";
    },
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
