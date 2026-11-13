import { DurableObject } from "cloudflare:workers";
import { CLOSE } from "../shared/protocol";
import { createRoom } from "../server/relay/room";

/**
 * One account's TV ↔ phone relay (WebSocket Hibernation API), one object per user. All logic lives in server/relay/.
 * The Worker has already checked the session: `?role=` says whether this is the account's TV or phone.
 * `POST /kick?role=&code=` closes that slot's socket (signed out elsewhere).
 */
export class Relay extends DurableObject {
  room = createRoom(() => this.ctx.getWebSockets());

  fetch(req: Request): Response {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    if (role !== "tv" && role !== "remote") return new Response("Bad role", { status: 400 });
    if (url.pathname === "/kick") {
      this.room.kick(role, Number(url.searchParams.get("code")) || CLOSE.signedOut);
      return new Response(null, { status: 204 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong")); // the clients' liveness check, answered without waking the object
    this.ctx.acceptWebSocket(server!);
    this.room.open(server!, role);
    return new Response(null, { status: 101, webSocket: client! });
  }
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    this.room.message(ws, message);
  }
  webSocketClose(ws: WebSocket) {
    this.room.close(ws);
  }
  webSocketError(ws: WebSocket) {
    this.room.close(ws);
  }
}
