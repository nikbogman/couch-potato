// One account's TV ↔ phone relay: one TV slot and one phone slot. A new connection in a slot replaces (and closes) the old one.
// Pure: knows nothing about sockets, only clients that can be sent messages and closed.
import type { NowPlaying } from "../../shared/playback";
import { CLOSE, type ClientMessage, type Role, type ServerMessage } from "../../shared/protocol";

export type Client = { send(msg: ServerMessage): void; close(code: number): void };

/** What a client's registration amounts to, so a relay can be rebuilt after the process holding it went away (Durable Object hibernation). */
export type Membership = { role: "tv"; playing?: NowPlaying } | { role: "remote" };

export function createRelay() {
  let tv: Client | undefined;
  let remote: Client | undefined;
  let playing: NowPlaying | undefined; // what the TV last said it is playing; absent = idle

  const idle = () => {
    if (!playing) return;
    playing = undefined;
    remote?.send({ type: "state", state: null });
  };

  function leave(c: Client) {
    if (c === remote) {
      remote = undefined;
      tv?.send({ type: "remotes", count: 0 });
    }
    if (c === tv) {
      tv = undefined;
      remote?.send({ type: "presence", tv: false });
      idle();
    }
  }

  return {
    /** `c` connected as `role` (from its session). Whoever held that slot is closed. */
    join(c: Client, role: Role) {
      if (c === tv || c === remote) return;
      if (role === "tv") {
        tv?.close(CLOSE.replaced);
        tv = c;
        idle();
        c.send({ type: "remotes", count: remote ? 1 : 0 });
        remote?.send({ type: "presence", tv: true });
      } else {
        remote?.close(CLOSE.replaced);
        remote = c;
        tv?.send({ type: "remotes", count: 1 });
        c.send({ type: "presence", tv: !!tv });
        if (playing) c.send({ type: "state", state: playing });
        tv?.send({ type: "sync" }); // so the player is asked for its status and the phone gets the real state
      }
    },
    /** `c`'s registration, or undefined if it holds no slot. */
    dump(c: Client): Membership | undefined {
      if (c === tv) return { role: "tv", ...(playing && { playing }) };
      if (c === remote) return { role: "remote" };
    },
    /** Re-register `c` from a dump. Sends nothing: everyone it would tell is already connected and has been told. */
    load(c: Client, m: Membership) {
      if (m.role === "remote") return void (remote = c);
      tv = c;
      playing = m.playing;
    },
    /** Handle one message from `c`. Messages from a client in the wrong role (or without a slot) are dropped. */
    receive(c: Client, m: ClientMessage) {
      if (c === tv) {
        if (m.type === "state") {
          playing = m.state ?? undefined;
          remote?.send(m);
        }
        return;
      }
      if (c !== remote || (m.type !== "play" && m.type !== "command")) return;
      if (tv) tv.send(m);
      else c.send({ type: "presence", tv: false }); // the phone's idea of "the TV is open" is stale; correct it
    },
    leave,
    /** Close the slot's client on purpose (signed out elsewhere). */
    kick(role: Role, code: number) {
      const c = role === "tv" ? tv : remote;
      if (!c) return;
      leave(c);
      c.close(code);
    },
  };
}
