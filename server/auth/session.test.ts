import { expect, test } from "bun:test";
import { safeNext } from "./login";
import { passwordMatches, readCookie, sessionValid, sessionValue, setCookie } from "./session";

test("passwordMatches is exact", async () => {
  expect(await passwordMatches("hunter2", "hunter2")).toBe(true);
  expect(await passwordMatches("hunter", "hunter2")).toBe(false);
  expect(await passwordMatches("", "hunter2")).toBe(false);
  expect(await passwordMatches("hunter2 ", "hunter2")).toBe(false);
});

test("a session is valid for the password that signed it, until it expires", async () => {
  const v = await sessionValue("pw", 1_000_000);
  expect(await sessionValid(v, "pw", 2_000_000)).toBe(true);
  expect(await sessionValid(v, "other", 2_000_000)).toBe(false);
  expect(await sessionValid(v, "pw", 1_000_000 + 366 * 24 * 3600 * 1000)).toBe(false);
});

test("tampered, truncated and malformed sessions are rejected", async () => {
  const v = await sessionValue("pw");
  const [exp, mac] = v.split(".") as [string, string];
  for (const bad of [undefined, "", "x", `${exp}.`, `.${mac}`, `${Number(exp) + 1}.${mac}`, `${exp}.${mac.slice(2)}`, `${exp}.${"0".repeat(mac.length)}`, `${exp}.zz`, `-1.${mac}`])
    expect(await sessionValid(bad, "pw")).toBe(false);
  expect(await sessionValid(v, "pw")).toBe(true);
});

test("cookie: parsed from the header; Secure only on https", () => {
  expect(readCookie("a=1; couch_session=abc.def; b=2")).toBe("abc.def");
  expect(readCookie("a=1")).toBeUndefined();
  expect(readCookie(null)).toBeUndefined();
  const https = setCookie("v", true);
  expect(https).toContain("HttpOnly");
  expect(https).toContain("SameSite=Lax");
  expect(https).toContain("Secure");
  expect(setCookie("v", false)).not.toContain("Secure");
});

test("safeNext only allows same-site paths", () => {
  expect(safeNext("/watch/movie/1?x=2")).toBe("/watch/movie/1?x=2");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", null, undefined]) expect(safeNext(bad)).toBe("/");
});
