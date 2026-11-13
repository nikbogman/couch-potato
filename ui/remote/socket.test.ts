import { expect, test } from "bun:test";
import { backoff, connectSocket } from "./socket";

(globalThis as { location?: unknown }).location ??= { protocol: "http:", host: "couch.test" };

function fake() {
  const socks: { url: string; sent: string[]; onopen?: () => void; onclose?: (e?: { code: number }) => void; onmessage?: (e: { data: unknown }) => void; readyState: number }[] = [];
  const dial = (url: string) => {
    const s = { url, sent: [] as string[], readyState: 1, send(d: string) { s.sent.push(d); }, close() {} };
    socks.push(s);
    return s as unknown as WebSocket;
  };
  const timers: [() => void, number][] = [];
  return { socks, timers, dial, later: ((fn: () => void, ms: number) => void timers.push([fn, ms])) as never };
}

test("backoff grows and caps", () => {
  expect([0, 1, 2, 3, 10].map(backoff)).toEqual([500, 1000, 2000, 4000, 10_000]);
});

test("reconnects with growing delay", () => {
  const f = fake();
  const states: boolean[] = [];
  connectSocket(() => {}, (o) => states.push(o), undefined, f.dial, f.later);
  const first = f.socks[0]!;
  expect(first.url).toBe("ws://couch.test/ws");
  first.onopen!();
  expect(first.sent).toEqual([]); // the server knows the role from the session

  first.onclose!();
  expect(f.timers.map((t) => t[1])).toEqual([500]);
  f.timers[0]![0]();
  f.socks[1]!.onclose!(); // still down: wait longer
  expect(f.timers.map((t) => t[1])).toEqual([500, 1000]);
  f.timers[1]![0]();
  f.socks[2]!.onopen!();
  expect(states).toEqual([true, false, false, true]);
});

test("closed on purpose by the server: says why and stays closed", () => {
  for (const [code, why] of [[4001, "replaced"], [4002, "signedOut"]] as const) {
    const f = fake();
    const kicked: string[] = [];
    connectSocket(() => {}, () => {}, (w) => kicked.push(w), f.dial, f.later);
    f.socks[0]!.onopen!();
    f.socks[0]!.onclose!({ code });
    expect(kicked).toEqual([why]);
    expect(f.timers).toEqual([]);
  }
});

test("close stops reconnecting; bad messages are ignored", () => {
  const f = fake();
  const got: unknown[] = [];
  const s = connectSocket((m) => got.push(m), () => {}, undefined, f.dial, f.later);
  f.socks[0]!.onmessage!({ data: "junk" });
  f.socks[0]!.onmessage!({ data: '{"type":"presence","tv":true}' });
  expect(got).toEqual([{ type: "presence", tv: true }]);
  s.close();
  f.socks[0]!.onclose!();
  expect(f.timers).toEqual([]);
});

test("heartbeat: a pong keeps the socket, a missing pong dials a new one", () => {
  const f = fake();
  const beats: [() => void, number][] = [];
  const hb = ((fn: () => void, ms: number) => (beats.push([fn, ms]), {})) as never;
  const states: boolean[] = [];
  const got: unknown[] = [];
  connectSocket((m) => got.push(m), (o) => states.push(o), undefined, f.dial, f.later, hb);
  const s = f.socks[0]!;
  s.onopen!();
  expect(beats.map((b) => b[1])).toEqual([20_000]);

  beats[0]![0](); // time to ping
  expect(s.sent.at(-1)).toBe("ping");
  expect(beats.at(-1)![1]).toBe(5_000); // and the wait for the pong starts
  s.onmessage!({ data: "pong" });
  expect(got).toEqual([]); // not a message for the app
  expect(beats.at(-1)![1]).toBe(20_000); // next beat scheduled

  beats[0]![0](); // ping again, this time nothing comes back
  beats.at(-1)![0]!();
  expect(f.socks.length).toBe(2); // redialled at once, without waiting for a close that may never come
  expect(states).toEqual([true, false]);
  expect(f.socks[1]!.url).toBe("ws://couch.test/ws");
});
