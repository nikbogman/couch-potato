import { expect, test } from "bun:test";
import type { ServerMessage } from "../../shared/protocol";
import { createRelay, type Client } from "./relay";

/** `got` leaves out the remote count TVs are sent; `counts` collects it. */
const peer = () => {
  const got: ServerMessage[] = [];
  const counts: number[] = [];
  return Object.assign({ send: (m: ServerMessage) => void (m.type === "remotes" ? counts.push(m.count) : got.push(m)) } satisfies Client, { got, counts });
};
const movie = { mediaType: "movie", id: 550 } as const;

function setup() {
  const relay = createRelay();
  const tv = () => {
    const p = peer();
    relay.receive(p, { type: "hello", role: "tv" });
    return p;
  };
  const remote = () => {
    const p = peer();
    relay.receive(p, { type: "hello", role: "remote" });
    return p;
  };
  return { relay, tv, remote };
}

test("play goes to the most recently active TV", () => {
  const { relay, tv, remote } = setup();
  const a = tv();
  const b = tv();
  const phone = remote();
  relay.receive(phone, { type: "play", target: movie });
  expect(b.got).toEqual([{ type: "sync" }, { type: "play", target: movie }]); // b joined last, and was asked for state when the phone joined
  relay.receive(a, { type: "active" });
  relay.receive(phone, { type: "play", target: movie });
  expect(a.got).toEqual([{ type: "play", target: movie }]);
  expect(b.got).toHaveLength(2);
});

test("with no TV, play is dropped and the phone is told there is none", () => {
  const { relay, remote } = setup();
  const phone = remote();
  relay.receive(phone, { type: "play", target: movie });
  expect(phone.got).toEqual([
    { type: "presence", tv: false },
    { type: "presence", tv: false },
  ]);
});

test("when the active TV disconnects, the next most recent one is the target", () => {
  const { relay, tv, remote } = setup();
  const a = tv();
  const b = tv();
  const phone = remote();
  relay.leave(b);
  relay.receive(phone, { type: "play", target: movie });
  expect(a.got).toEqual([{ type: "play", target: movie }]);
});

test("remotes see presence on join and when TVs come and go", () => {
  const { relay, tv, remote } = setup();
  const phone = remote();
  const a = tv();
  const b = tv();
  relay.leave(a);
  relay.leave(b);
  expect(phone.got.map((m) => m.type === "presence" && m.tv)).toEqual([false, true, true, true, false]);
});

test("a late-joining remote is told a TV is open", () => {
  const { tv, remote } = setup();
  tv();
  expect(remote().got).toEqual([{ type: "presence", tv: true }]);
});

test("a TV cannot cast, a remote cannot become a TV, and nobody can speak before hello", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const phone = remote();
  const stranger = peer();
  relay.receive(t, { type: "play", target: movie });
  relay.receive(stranger, { type: "play", target: movie });
  relay.receive(phone, { type: "hello", role: "tv" });
  expect(t.got).toEqual([{ type: "sync" }]); // only from the phone joining
  relay.receive(phone, { type: "play", target: movie });
  expect(t.got).toEqual([{ type: "sync" }, { type: "play", target: movie }]);
  relay.leave(phone);
  expect(phone.got).toEqual([{ type: "presence", tv: true }]);
});

const state = (title: string) =>
  ({ target: movie, title, episode: null, art: null, position: 5, duration: 100, playing: true, muted: false, volume: 1, player: "playerone", canNext: false, fullscreen: false, episodeName: null }) as const;

test("a command goes to the active TV only", () => {
  const { relay, tv, remote } = setup();
  const a = tv();
  const b = tv();
  const phone = remote();
  b.got.length = 0;
  relay.receive(phone, { type: "command", command: { cmd: "seekBy", delta: 30 } });
  expect(b.got).toEqual([{ type: "command", command: { cmd: "seekBy", delta: 30 } }]);
  expect(a.got).toEqual([]);
  relay.receive(a, { type: "state", state: null });
  relay.receive(a, { type: "active" });
  relay.receive(phone, { type: "command", command: { cmd: "stop" } });
  expect(a.got).toEqual([{ type: "command", command: { cmd: "stop" } }]);
});

test("a playback command goes to the TV that is playing, even when another TV was active more recently", () => {
  const { relay, tv, remote } = setup();
  const playing = tv();
  const idle = tv();
  const phone = remote();
  relay.receive(playing, { type: "state", state: state("A") });
  relay.receive(idle, { type: "active" }); // e.g. a laptop tab with Couch open got focus
  playing.got.length = 0;
  idle.got.length = 0;
  relay.receive(phone, { type: "command", command: { cmd: "pause" } });
  expect(playing.got).toEqual([{ type: "command", command: { cmd: "pause" } }]);
  expect(idle.got).toEqual([]);
  // Casting a new title still goes to the most recently active TV.
  relay.receive(phone, { type: "play", target: movie });
  expect(idle.got).toEqual([{ type: "play", target: movie }]);
});

test("TV state reaches every remote; a TV cannot send commands and a remote cannot report state", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const p1 = remote();
  const p2 = remote();
  relay.receive(t, { type: "state", state: state("A") });
  expect(p1.got.at(-1)).toEqual({ type: "state", state: state("A") });
  expect(p2.got.at(-1)).toEqual({ type: "state", state: state("A") });
  const n = p1.got.length;
  relay.receive(p1, { type: "state", state: state("fake") });
  expect(p2.got).toHaveLength(n);
  t.got.length = 0;
  relay.receive(t, { type: "command", command: { cmd: "stop" } });
  expect(t.got).toEqual([]);
});

test("a joining remote gets the cached state and the TV is asked to sync", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  relay.receive(t, { type: "state", state: state("A") });
  const late = remote();
  expect(late.got).toEqual([{ type: "presence", tv: true }, { type: "state", state: state("A") }]);
  expect(t.got).toEqual([{ type: "sync" }]);
});

test("idle clears the cache; another TV's idle does not; a leaving TV clears it for the phone", () => {
  const { relay, tv, remote } = setup();
  const a = tv();
  const b = tv();
  const phone = remote();
  relay.receive(a, { type: "state", state: state("A") });
  relay.receive(b, { type: "state", state: null }); // b is idle, a is playing
  expect(phone.got.at(-1)).toEqual({ type: "state", state: state("A") });
  relay.leave(a);
  expect(phone.got.at(-1)).toEqual({ type: "state", state: null });
  expect(remote().got).toEqual([{ type: "presence", tv: true }]);
});

test("TVs are told how many remotes are connected, on join and as phones come and go", () => {
  const { relay, tv, remote } = setup();
  const a = tv();
  const phone = remote();
  const b = tv();
  const phone2 = remote();
  relay.leave(phone);
  relay.leave(phone2);
  expect(a.counts).toEqual([0, 1, 2, 1, 0]);
  expect(b.counts).toEqual([1, 2, 1, 0]);
  expect(phone.counts).toEqual([]);
});
