import { expect, test } from "bun:test";
import { CLOSE, type ServerMessage } from "../../shared/protocol";
import { createRelay, type Client } from "./relay";

/** `got` leaves out the phone count the TV is sent; `counts` collects it. `closed` is the close code, if closed. */
const peer = () => {
  const p: Client & { got: ServerMessage[]; counts: number[]; closed?: number } = {
    got: [],
    counts: [],
    send: (m) => void (m.type === "remotes" ? p.counts.push(m.count) : p.got.push(m)),
    close: (code) => void (p.closed = code),
  };
  return p;
};
const movie = { mediaType: "movie", id: 550 } as const;
const state = (title: string) =>
  ({ target: movie, title, episode: null, art: null, position: 5, duration: 100, playing: true, muted: false, volume: 1, player: "p1", canNext: false, fullscreen: false, episodeName: null }) as const;

function setup() {
  const relay = createRelay();
  const tv = () => {
    const p = peer();
    relay.join(p, "tv");
    return p;
  };
  const remote = () => {
    const p = peer();
    relay.join(p, "remote");
    return p;
  };
  return { relay, tv, remote };
}

test("the phone casts and commands its TV", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const phone = remote();
  relay.receive(phone, { type: "play", target: movie });
  relay.receive(phone, { type: "command", command: { cmd: "pause" } });
  expect(t.got).toEqual([{ type: "sync" }, { type: "play", target: movie }, { type: "command", command: { cmd: "pause" } }]);
});

test("a new TV replaces the old one: the old one is closed and gets nothing more", () => {
  const { relay, tv, remote } = setup();
  const old = tv();
  const phone = remote();
  relay.receive(old, { type: "state", state: state("A") });
  const fresh = tv();
  expect(old.closed).toBe(CLOSE.replaced);
  expect(phone.got.slice(-2)).toEqual([{ type: "state", state: null }, { type: "presence", tv: true }]); // the old TV's playback is gone
  relay.receive(phone, { type: "play", target: movie });
  expect(fresh.got).toEqual([{ type: "play", target: movie }]);
  expect(old.got).toEqual([{ type: "sync" }]);
  relay.leave(old); // its close arrives later: changes nothing
  expect(phone.got.at(-1)).toEqual({ type: "presence", tv: true });
});

test("a new phone replaces the old one", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const old = remote();
  const fresh = remote();
  expect(old.closed).toBe(CLOSE.replaced);
  relay.receive(old, { type: "play", target: movie });
  expect(t.got).toEqual([{ type: "sync" }, { type: "sync" }]);
  relay.receive(t, { type: "state", state: state("A") });
  expect(fresh.got.at(-1)).toEqual({ type: "state", state: state("A") });
  expect(old.got).not.toContainEqual({ type: "state", state: state("A") });
  expect(t.counts).toEqual([0, 1, 1]);
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

test("the phone sees presence on join and when the TV comes and goes", () => {
  const { relay, tv, remote } = setup();
  const phone = remote();
  const t = tv();
  relay.leave(t);
  expect(phone.got).toEqual([{ type: "presence", tv: false }, { type: "presence", tv: true }, { type: "presence", tv: false }]);
});

test("a TV cannot cast and a phone cannot report state; strangers are ignored", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const phone = remote();
  const stranger = peer();
  relay.receive(t, { type: "play", target: movie });
  relay.receive(stranger, { type: "play", target: movie });
  relay.receive(phone, { type: "state", state: state("fake") });
  expect(t.got).toEqual([{ type: "sync" }]);
  expect(phone.got).toEqual([{ type: "presence", tv: true }]);
});

test("a joining phone gets the cached state and the TV is asked to sync; idle and a leaving TV clear it", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  relay.receive(t, { type: "state", state: state("A") });
  const phone = remote();
  expect(phone.got).toEqual([{ type: "presence", tv: true }, { type: "state", state: state("A") }]);
  expect(t.got).toEqual([{ type: "sync" }]);
  relay.receive(t, { type: "state", state: null });
  expect(remote().got).toEqual([{ type: "presence", tv: true }]);
  relay.receive(t, { type: "state", state: state("B") });
  relay.leave(t);
  expect(relay.dump(t)).toBeUndefined();
});

test("the TV is told whether its phone is connected", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const phone = remote();
  relay.leave(phone);
  expect(t.counts).toEqual([0, 1, 0]);
  expect(phone.counts).toEqual([]);
});

test("kick closes the slot's client with the code and frees the slot", () => {
  const { relay, tv, remote } = setup();
  const t = tv();
  const phone = remote();
  relay.kick("tv", CLOSE.signedOut);
  expect(t.closed).toBe(CLOSE.signedOut);
  expect(phone.got.at(-1)).toEqual({ type: "presence", tv: false });
  relay.kick("tv", CLOSE.signedOut); // nobody there: nothing happens
  relay.kick("remote", CLOSE.replaced);
  expect(phone.closed).toBe(CLOSE.replaced);
});
