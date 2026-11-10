import { expect, test } from "bun:test";
import type { ServerMessage } from "../../shared/protocol";
import { createRoom, type Sock } from "./room";

/** A fake hibernatable socket: records what the server sent and keeps its attachment like the platform does. */
function sock() {
  const sent: ServerMessage[] = [];
  let att: unknown = null;
  const s: Sock & { sent: ServerMessage[] } = {
    sent,
    send: (d) => void sent.push(JSON.parse(d)),
    serializeAttachment: (v) => void (att = structuredClone(v)),
    deserializeAttachment: () => att,
  };
  return s;
}
const send = (room: ReturnType<typeof createRoom>, s: Sock, m: unknown) => room.message(s, JSON.stringify(m));
const state = { target: { mediaType: "movie" as const, id: 1 }, title: "T", episode: null, art: null, position: 5, duration: 100, playing: false, muted: false, volume: 1, player: "playerone" as const, canNext: false, fullscreen: false };

test("a phone's play reaches the TV and presence follows the TV", () => {
  const all: Sock[] = [];
  const room = createRoom(() => all);
  const phone = sock(), tv = sock();
  all.push(phone, tv);
  send(room, phone, { type: "hello", role: "remote" });
  send(room, tv, { type: "hello", role: "tv" });
  send(room, phone, { type: "play", target: { mediaType: "movie", id: 7 } });
  expect(phone.sent).toEqual([{ type: "presence", tv: false }, { type: "presence", tv: true }]);
  expect(tv.sent).toEqual([{ type: "remotes", count: 1 }, { type: "play", target: { mediaType: "movie", id: 7 } }]);
  room.close(tv);
  expect(phone.sent.at(-1)).toEqual({ type: "presence", tv: false });
});

test("garbage, oversize and binary messages are ignored", () => {
  const room = createRoom(() => []);
  const s = sock();
  room.message(s, "not json");
  room.message(s, new ArrayBuffer(4));
  room.message(s, JSON.stringify({ type: "hello", role: "remote", pad: "x".repeat(5000) }));
  expect(s.sent).toEqual([]);
});

test("after hibernation a new room is rebuilt from the sockets: roles, TV choice and cached state survive", () => {
  const all: Sock[] = [];
  const room = createRoom(() => all);
  const tv = sock(), phone = sock();
  all.push(tv, phone);
  send(room, tv, { type: "hello", role: "tv" });
  send(room, tv, { type: "state", state });
  send(room, phone, { type: "hello", role: "remote" });

  // evicted: all in-memory state is gone, the sockets and their attachments remain
  const woken = createRoom(() => all);
  send(woken, phone, { type: "command", command: { cmd: "play" } });
  expect(tv.sent.at(-1)).toEqual({ type: "command", command: { cmd: "play" } });

  const late = sock();
  all.push(late);
  send(woken, late, { type: "hello", role: "remote" });
  expect(late.sent).toEqual([{ type: "presence", tv: true }, { type: "state", state }]);
  send(woken, tv, { type: "state", state: null });
  expect(late.sent.at(-1)).toEqual({ type: "state", state: null });
});
