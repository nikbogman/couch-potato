// The relay on top of hibernatable WebSockets. The Durable Object can be evicted while sockets stay open, so each socket's
// registration lives in its attachment and a new room rebuilds the relay from the sockets that are still there.
import { parseClientMessage } from "../../shared/protocol";
import { createRelay, type Client, type Membership } from "./relay";

export type Sock = { send(data: string): void; serializeAttachment(v: unknown): void; deserializeAttachment(): unknown };

const MAX_MESSAGE = 4096; // messages are tiny JSON; refuse anything bigger

/** `live` lists the currently open sockets (`ctx.getWebSockets()`). */
export function createRoom(live: () => Sock[]) {
  const relay = createRelay();
  const clients = new Map<Sock, Client>();
  const client = (ws: Sock) => {
    let c = clients.get(ws);
    if (!c) clients.set(ws, (c = { send: (m) => { try { ws.send(JSON.stringify(m)); } catch {} } }));
    return c;
  };

  for (const ws of live()) {
    const m = ws.deserializeAttachment() as Membership | null;
    if (m) relay.load(client(ws), m);
  }

  return {
    message(ws: Sock, raw: string | ArrayBuffer) {
      const m = typeof raw === "string" && raw.length <= MAX_MESSAGE ? parseClientMessage(raw) : null;
      if (!m) return;
      relay.receive(client(ws), m);
      for (const [s, c] of clients) {
        const d = relay.dump(c);
        if (d) try { s.serializeAttachment(d); } catch {}
      }
    },
    close(ws: Sock) {
      const c = clients.get(ws);
      if (c) relay.leave(c);
      clients.delete(ws);
    },
  };
}
