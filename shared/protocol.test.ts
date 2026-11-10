import { expect, test } from "bun:test";
import { parseClientMessage, parseServerMessage, watchPath } from "./protocol";

const parse = (m: unknown) => parseClientMessage(JSON.stringify(m));

test("accepts well-formed client messages", () => {
  expect(parse({ type: "hello", role: "tv" })).toEqual({ type: "hello", role: "tv" });
  expect(parse({ type: "active" })).toEqual({ type: "active" });
  expect(parse({ type: "play", target: { mediaType: "movie", id: 550 } })).toEqual({ type: "play", target: { mediaType: "movie", id: 550 } });
  expect(parse({ type: "play", target: { mediaType: "tv", id: "1399", season: 0, episode: 3, extra: 1 } })).toEqual({
    type: "play",
    target: { mediaType: "tv", id: "1399", season: 0, episode: 3 },
  });
});

test("rejects malformed messages", () => {
  expect(parseClientMessage("not json")).toBeNull();
  for (const m of [
    null,
    {},
    { type: "hello", role: "admin" },
    { type: "play" },
    { type: "play", target: { mediaType: "movie", id: "../x" } },
    { type: "play", target: { mediaType: "tv", id: 1, season: 1 } },
    { type: "play", target: { mediaType: "tv", id: 1, season: -1, episode: 1 } },
    { type: "play", target: { mediaType: "tv", id: 1, season: 1, episode: 0 } },
    { type: "play", target: { mediaType: "show", id: 1 } },
  ])
    expect(parse(m)).toBeNull();
});

test("validates server messages too", () => {
  expect(parseServerMessage('{"type":"presence","tv":true}')).toEqual({ type: "presence", tv: true });
  expect(parseServerMessage('{"type":"presence","tv":"yes"}')).toBeNull();
  expect(parseServerMessage('{"type":"remotes","count":2}')).toEqual({ type: "remotes", count: 2 });
  expect(parseServerMessage('{"type":"remotes","count":-1}')).toBeNull();
  expect(parseServerMessage('{"type":"play","target":{"mediaType":"movie","id":1}}')).toEqual({ type: "play", target: { mediaType: "movie", id: 1 } });
});

test("watchPath is the player route", () => {
  expect(watchPath({ mediaType: "movie", id: 550 })).toBe("/watch/movie/550");
  expect(watchPath({ mediaType: "tv", id: "1399", season: 2, episode: 4 })).toBe("/watch/tv/1399/2/4");
});

test("command and state messages are validated both ways", () => {
  expect(parse({ type: "command", command: { cmd: "seekBy", delta: 30 } })).toEqual({ type: "command", command: { cmd: "seekBy", delta: 30 } });
  expect(parse({ type: "command", command: { cmd: "format" } })).toBeNull();
  expect(parse({ type: "state", state: null })).toEqual({ type: "state", state: null });
  expect(parse({ type: "state", state: { title: "x" } })).toBeNull();
  expect(parseServerMessage('{"type":"sync"}')).toEqual({ type: "sync" });
  expect(parseServerMessage('{"type":"command","command":{"cmd":"stop"}}')).toEqual({ type: "command", command: { cmd: "stop" } });
  expect(parseServerMessage('{"type":"state","state":null}')).toEqual({ type: "state", state: null });
  expect(parseServerMessage('{"type":"state","state":5}')).toBeNull();
});
