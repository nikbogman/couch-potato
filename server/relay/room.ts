// The relay on top of hibernatable WebSockets. The Durable Object can be evicted while sockets stay open, so each socket's
// registration lives in its attachment and a new room rebuilds the relay from the sockets that are still there.
import { parseClientMessage, type Role } from "../../shared/protocol";
import { createRelay, type Client, type Membership } from "./relay";

export type Sock = {
  send(data: string): void;
  close(code: number, reason: string): void;
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
};

const MAX_MESSAGE = 4096; // messages are tiny JSON; refuse anything bigger

/** `live` lists the currently open sockets (`ctx.getWebSockets()`). */
export function createRoom(live: () => Sock[]) {
  const relay = createRelay();
  const clients = new Map<Sock, Client>();
  const client = (ws: Sock) => {
    let c = clients.get(ws);
    if (!c)
      clients.set(
        ws,
        (c = {
          send: (m) => { try { ws.send(JSON.stringify(m)); } catch {} },
          close: (code) => { try { ws.close(code, "signed out"); } catch {} },
        }),
      );
    return c;
  };
  /** Write every socket's registration back, so a woken room sees who holds which slot (null: none, e.g. replaced). */
  const persist = () => {
    for (const [s, c] of clients) try { s.serializeAttachment(relay.dump(c) ?? null); } catch {}
  };

  for (const ws of live()) {
    const m = ws.deserializeAttachment() as Membership | null;
    if (m) relay.load(client(ws), m);
  }

  return {
    /** A socket just accepted for a session with `role`. */
    open(ws: Sock, role: Role) {
      relay.join(client(ws), role);
      persist();
    },
    message(ws: Sock, raw: string | ArrayBuffer) {
      const m = typeof raw === "string" && raw.length <= MAX_MESSAGE ? parseClientMessage(raw) : null;
      if (!m) return;
      relay.receive(client(ws), m);
      persist();
    },
    close(ws: Sock) {
      const c = clients.get(ws);
      if (c) relay.leave(c);
      clients.delete(ws);
      persist();
    },
    kick(role: Role, code: number) {
      relay.kick(role, code);
      persist();
    },
  };
}
