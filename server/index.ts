/**
 * Server Entry Point
 * Initializes Next.js, HTTP server, WebSocket server, and Gateway connection
 */

require("dotenv").config({ path: ".env.local", override: true });

import { createServer } from "http";
import { parse } from "url";
import * as path from "path";
import fs from "fs";
import next from "next";
import { GatewayClient } from "./core/GatewayClient";
import { WebSocketServer } from "./core/WebSocketServer";
import { NotesManager } from "./core/NotesManager";
import { configManager } from "./handlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Cache package version for health checks
// Use path.join to resolve package.json location properly in both dev and production
const packageJsonPath = dev
  ? path.join(__dirname, "../package.json")
  : path.join(__dirname, "../../package.json");
const packageVersion = require(packageJsonPath).version;
const notesManager = new NotesManager();

const imageContentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    // Health check endpoint
    if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/api/health") {
      const gateway = configManager.getActiveGateway();
      const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "mission-control",
        version: packageVersion,
        gateway: gateway
          ? {
              connected: true,
              name: gateway.name,
              url: gateway.url,
            }
          : {
              connected: false,
            },
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(healthStatus, null, 2));
      return;
    }

    if (parsedUrl.pathname?.startsWith("/api/notes/images/")) {
      const requestedFile = parsedUrl.pathname.replace("/api/notes/images/", "");
      const safeFileName = path.basename(decodeURIComponent(requestedFile));
      const imagePath = path.join(notesManager.getImagesDir(), safeFileName);

      if (!fs.existsSync(imagePath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Image not found" }));
        return;
      }

      const extension = path.extname(imagePath).toLowerCase();
      const contentType = imageContentTypes[extension] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      });

      fs.createReadStream(imagePath).pipe(res);
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Initialize Gateway connection
  const gateway = new GatewayClient(configManager);

  // Initialize WebSocket server
  const wsServer = new WebSocketServer(gateway);
  wsServer.handleUpgrade(server);

  // Connect to gateway and start polling
  gateway.connect();
  gateway.startPolling();

  server.listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Gateway: ${gateway.getUrl() || "None"}`);
  });
});
