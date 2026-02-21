/**
 * WebSocket Server
 * Manages client WebSocket connections and message routing
 */

import { WebSocketServer as WSServer } from "ws";
import type { Server as HTTPServer } from "http";
import { parse } from "url";
import type { ExtendedWebSocket, ClientMessage } from "../types/internal";
import { GatewayClient } from "./GatewayClient";
import { handleMessage } from "../handlers";

export class WebSocketServer {
  private wss: WSServer;
  private gateway: GatewayClient;
  private sessionPatches: Map<string, any> = new Map();

  constructor(gateway: GatewayClient) {
    this.wss = new WSServer({ noServer: true });
    this.gateway = gateway;
  }

  handleUpgrade(server: HTTPServer): void {
    server.on("upgrade", (req, socket, head) => {
      const { pathname } = parse(req.url || "", true);

      // Check for both paths to support local dev and production
      if (pathname === "/api/ws" || pathname === "/mission-controle/api/ws") {
        this.wss.handleUpgrade(req, socket, head, (ws: ExtendedWebSocket) => {
          console.log("[Client] New WebSocket connection");

          this.gateway.addClient(ws);

          ws.on("message", async (data: Buffer) => {
            console.log("[Client] Message:", data.toString());
            try {
              const msg: ClientMessage = JSON.parse(data.toString());
              await handleMessage(msg, ws, this.gateway, this.sessionPatches);
            } catch (err) {
              console.error("[Client] Failed to parse message:", err);
            }
          });

          ws.on("close", () => {
            console.log("[Client] WebSocket closed");
            this.gateway.removeClient(ws);
          });

          ws.on("error", (err: Error) => {
            console.error("[Client] WebSocket error:", err);
          });
        });
      } else {
        socket.destroy();
      }
    });
  }
}
