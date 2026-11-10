// Phone ↔ TV registry and relay. Pure: knows nothing about sockets, only clients that can be sent messages.
import type { NowPlaying } from "../../shared/playback";
import type { ClientMessage, Role, ServerMessage } from "../../shared/protocol";

export type Client = { send(msg: ServerMessage): void };

/** What a client's registration amounts to, so a relay can be rebuilt after the process holding it went away (Durable Object hibernation). */
export type Membership = { role: "tv"; clock: number; playing?: NowPlaying } | { role: "remote" };

export function createRelay() {
  const tvs = new Map<Client, number>(); // client → when it was last active (logical clock, so ties can't happen)
  const remotes = new Set<Client>();
  let clock = 0;
  let latest: { tv: Client; state: NowPlaying } | undefined; // what the last TV to report is playing; absent = idle

  const presence = (): ServerMessage => ({ type: "presence", tv: tvs.size > 0 });
  const tellRemotes = () => remotes.forEach((r) => r.send(presence()));
  const remoteCount = (): ServerMessage => ({ type: "remotes", count: remotes.size });
  const tellTvs = () => tvs.forEach((_, t) => t.send(remoteCount()));
  const touch = (c: Client) => tvs.has(c) && tvs.set(c, ++clock);
  /** The most recently active TV. */
  const target = () => [...tvs].reduce<[Client, number] | undefined>((best, e) => (!best || e[1] > best[1] ? e : best), undefined)?.[0];

  function join(c: Client, role: Role) {
    if (tvs.has(c) || remotes.has(c)) return; // role is fixed for the life of the connection
    if (role === "tv") {
      tvs.set(c, ++clock);
      c.send(remoteCount());
      tellRemotes();
    } else {
      remotes.add(c);
      tellTvs();
      c.send(presence());
      if (latest) c.send({ type: "state", state: latest.state });
      target()?.send({ type: "sync" }); // so the player is asked for its status and the phone gets the real state
    }
  }

  return {
    join,
    /** `c`'s registration, or undefined if it hasn't said hello. `playing` is set when `c` is the TV the remotes are being shown. */
    dump(c: Client): Membership | undefined {
      const clock = tvs.get(c);
      if (clock !== undefined) return { role: "tv", clock, ...(latest?.tv === c && { playing: latest.state }) };
      return remotes.has(c) ? { role: "remote" } : undefined;
    },
    /** Re-register `c` from a dump. Sends nothing: everyone it would tell is already connected and has been told. */
    load(c: Client, m: Membership) {
      if (m.role === "remote") return void remotes.add(c);
      tvs.set(c, m.clock);
      clock = Math.max(clock, m.clock);
      if (m.playing) latest = { tv: c, state: m.playing };
    },
    /** Handle one message from `c`. Messages from a client in the wrong role (or before `hello`) are dropped. */
    receive(c: Client, m: ClientMessage) {
      if (m.type === "hello") return join(c, m.role);
      if (tvs.has(c)) {
        touch(c); // `active`, and anything else a TV says, is activity
        if (m.type === "state") {
          if (m.state) latest = { tv: c, state: m.state };
          else if (latest && latest.tv !== c) return; // an idle TV doesn't hide what another one is playing
          else latest = undefined;
          remotes.forEach((r) => r.send(m));
        }
        return;
      }
      if (!remotes.has(c)) return;
      if (m.type === "play" || m.type === "command") {
        // Playback commands belong to the TV whose state the phone is showing; casting goes to the one in use.
        const tv = m.type === "command" && latest ? latest.tv : target();
        if (tv) tv.send(m);
        else c.send(presence()); // the phone's idea of "a TV is open" is stale; correct it
      }
    },
    leave(c: Client) {
      if (remotes.delete(c)) tellTvs();
      if (tvs.delete(c)) {
        tellRemotes();
        if (latest?.tv === c) {
          latest = undefined;
          remotes.forEach((r) => r.send({ type: "state", state: null }));
        }
      }
    },
  };
}
