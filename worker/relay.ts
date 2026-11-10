import { DurableObject } from "cloudflare:workers";
import { createRoom } from "../server/relay/room";

/** The single phone ↔ TV relay (WebSocket Hibernation API). All logic lives in server/relay/. */
export class Relay extends DurableObject {
  room = createRoom(() => this.ctx.getWebSockets());

  fetch(): Response {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong")); // the clients' liveness check, answered without waking the object
    this.ctx.acceptWebSocket(server!);
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
