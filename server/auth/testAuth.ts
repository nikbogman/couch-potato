// Test helper: a user with a live session, as the cookie header a browser would send.
import type { D1Like } from "../progress/store";
import { createAccounts, type Role } from "./accounts";
import { SESSION } from "./session";

export const PASSWORD = "correct horse";

/** Creates `name` if needed and signs in its phone (remote) or pairs its TV. The first user created is the owner (id 1). */
export async function signedIn(db: D1Like, { name = "nik", role = "remote" as Role, owner = true } = {}): Promise<string> {
  const a = createAccounts(db);
  await a.createUser(name, PASSWORD, owner);
  if (role === "remote") return `${SESSION}=${(await a.signIn(name, PASSWORD))!.cookie}`;
  const { id } = (await db.prepare("select id from users where name = ?1").bind(name).first<{ id: number }>())!; // not signIn: that would sign the phone out
  const p = await a.startPairing();
  await a.approve(p.code, id);
  const s = await a.collect(p.secret);
  if (typeof s === "string") throw new Error(s);
  return `${SESSION}=${s.cookie}`;
}
