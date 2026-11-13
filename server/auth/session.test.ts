import { expect, test } from "bun:test";
import { memoryD1 } from "../progress/testDb";
import { createAccounts } from "./accounts";
import { hashPassword, normalizeCode, pairingCode, verifyPassword } from "./crypto";
import { safeNext } from "./pages";
import { readCookie, setCookie } from "./session";

test("passwords: a hash verifies only its own password, and is salted", async () => {
  const h = await hashPassword("hunter22");
  expect(h).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  expect(await verifyPassword("hunter22", h)).toBe(true);
  for (const wrong of ["hunter2", "hunter22 ", ""]) expect(await verifyPassword(wrong, h)).toBe(false);
  expect(await hashPassword("hunter22")).not.toBe(h);
  expect(await verifyPassword("x", "garbage")).toBe(false);
});

test("pairing codes: 6 unambiguous characters; typing is forgiving", () => {
  for (let i = 0; i < 50; i++) expect(pairingCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  expect(normalizeCode("k7m 4qx")).toBe("K7M4QX");
  expect(normalizeCode("K7M-4QX")).toBe("K7M4QX");
  for (const bad of ["K7M4Q", "K7M4QX1", "O0I1LL", 42, null]) expect(normalizeCode(bad)).toBeNull();
});

test("pairing codes and invites expire", async () => {
  let t = 1_000_000;
  const a = createAccounts(memoryD1(), () => t);
  const id = (await a.createUser("nik", "password1", true))!;
  const p = await a.startPairing();
  t += 5 * 60_000;
  expect(await a.approve(p.code, id)).toBe(false);
  expect(await a.collect(p.secret)).toBe("expired");
  const { token } = await a.createInvite();
  t += 7 * 24 * 3600_000;
  expect(await a.inviteValid(token)).toBe(false);
  expect(await a.join(token, "ana", "password1")).toBe("invalid");
});

test("cookie: parsed from the header; Secure only on https; Max-Age 0 clears", () => {
  expect(readCookie("a=1; couch_session=1.abc; b=2")).toBe("1.abc");
  expect(readCookie("a=1")).toBeUndefined();
  expect(readCookie(null)).toBeUndefined();
  const https = setCookie("v", true);
  for (const attr of ["HttpOnly", "SameSite=Lax", "Secure"]) expect(https).toContain(attr);
  expect(setCookie("v", false)).not.toContain("Secure");
  expect(setCookie("", true, { name: "couch_pair", maxAge: 0 })).toStartWith("couch_pair=; Max-Age=0");
});

test("safeNext only allows same-site paths", () => {
  expect(safeNext("/watch/movie/1?x=2")).toBe("/watch/movie/1?x=2");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", null, undefined]) expect(safeNext(bad)).toBe("/remote");
});
