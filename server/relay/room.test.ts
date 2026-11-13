import { expect, test } from "bun:test";
import { CLOSE, type ServerMessage } from "../../shared/protocol";
import { createRoom, type Sock } from "./room";

/** A fake hibernatable socket: records what the server sent and keeps its attachment like the platform does. */
function sock() {
  const sent: ServerMessage[] = [];
  let att: unknown = null;
  const s: Sock & { sent: ServerMessage[]; closed?: number } = {
    sent,
    send: (d) => void sent.push(JSON.parse(d)),
    close: (code) => void (s.closed = code),
    serializeAttachment: (v) => void (att = structuredClone(v)),
    deserializeAttachment: () => att,
  };
  return s;
}
const send = (room: ReturnType<typeof createRoom>, s: Sock, m: unknown) => room.message(s, JSON.stringify(m));
const state = { target: { mediaType: "movie" as const, id: 1 }, title: "T", episode: null, art: null, position: 5, duration: 100, playing: false, muted: false, volume: 1, player: "p1" as const, canNext: false, fullscreen: false, episodeName: null };

test("a phone's play reaches the TV and presence follows the TV", () => {
  const all: Sock[] = [];
  const room = createRoom(() => all);
  const phone = sock(), tv = sock();
  all.push(phone, tv);
  room.open(phone, "remote");
  room.open(tv, "tv");
  send(room, phone, { type: "play", target: { mediaType: "movie", id: 7 } });
  expect(phone.sent).toEqual([{ type: "presence", tv: false }, { type: "presence", tv: true }]);
  expect(tv.sent).toEqual([{ type: "remotes", count: 1 }, { type: "play", target: { mediaType: "movie", id: 7 } }]);
  room.close(tv);
  expect(phone.sent.at(-1)).toEqual({ type: "presence", tv: false });
});

test("garbage, oversize and binary messages are ignored", () => {
  const room = createRoom(() => []);
  const s = sock();
  room.open(s, "remote");
  room.message(s, "not json");
  room.message(s, new ArrayBuffer(4));
  room.message(s, JSON.stringify({ type: "play", target: { mediaType: "movie", id: 1 }, pad: "x".repeat(5000) }));
  expect(s.sent).toEqual([{ type: "presence", tv: false }]); // only the hello from joining
});

test("a second TV socket closes the first; kick closes by role", () => {
  const all: Sock[] = [];
  const room = createRoom(() => all);
  const a = sock(), b = sock(), phone = sock();
  all.push(a, b, phone);
  room.open(a, "tv");
  room.open(phone, "remote");
  room.open(b, "tv");
  expect(a.closed).toBe(CLOSE.replaced);
  expect(a.deserializeAttachment()).toBeNull(); // a woken room won't take it for the TV
  room.kick("tv", CLOSE.signedOut);
  expect(b.closed).toBe(CLOSE.signedOut);
  expect(phone.sent.at(-1)).toEqual({ type: "presence", tv: false });
});

test("after hibernation a new room is rebuilt from the sockets: roles and cached state survive", () => {
  const all: Sock[] = [];
  const room = createRoom(() => all);
  const tv = sock(), phone = sock();
  all.push(tv, phone);
  room.open(tv, "tv");
  send(room, tv, { type: "state", state });
  room.open(phone, "remote");

  // evicted: all in-memory state is gone, the sockets and their attachments remain
  const woken = createRoom(() => all);
  send(woken, phone, { type: "command", command: { cmd: "play" } });
  expect(tv.sent.at(-1)).toEqual({ type: "command", command: { cmd: "play" } });

  const late = sock();
  all.push(late);
  woken.open(late, "remote");
  expect(phone.closed).toBe(CLOSE.replaced);
  expect(late.sent).toEqual([{ type: "presence", tv: true }, { type: "state", state }]);
  send(woken, tv, { type: "state", state: null });
  expect(late.sent.at(-1)).toEqual({ type: "state", state: null });
});
