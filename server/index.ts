/**
 * Server Entry Point
 * Initializes Next.js, HTTP server, WebSocket server, and Gateway connection
 */

require("dotenv").config({ path: ".env.local", override: true });

import { createServer } from "http";
import { parse } from "url";
import * as path from "path";
import fs from "fs";
import { pipeline } from "stream";
import next from "next";
import { GatewayClient } from "./core/GatewayClient";
import { WebSocketServer } from "./core/WebSocketServer";
import { NotesManager } from "./core/NotesManager";
import { configManager } from "./handlers";
import * as VsCodeService from "./core/VsCodeService";

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

    if (
      req.method === "GET" &&
      (parsedUrl.pathname === "/api/github/asset" ||
        parsedUrl.pathname === "/mission-controle/api/github/asset")
    ) {
      const targetUrlRaw = Array.isArray(parsedUrl.query.url)
        ? parsedUrl.query.url[0]
        : parsedUrl.query.url;

      if (!targetUrlRaw) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required query parameter: url" }));
        return;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(targetUrlRaw);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid url parameter" }));
        return;
      }

      const isAllowedHost = targetUrl.hostname === "github.com";
      const isAllowedPath = targetUrl.pathname.startsWith("/user-attachments/assets/");

      if (!isAllowedHost || !isAllowedPath) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Only github.com/user-attachments/assets URLs are allowed" }));
        return;
      }

      const cookies = Object.fromEntries(
        (req.headers.cookie || "")
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const idx = part.indexOf("=");
            if (idx === -1) return [part, ""] as const;
            return [part.slice(0, idx), part.slice(idx + 1)] as const;
          })
      );

      const authHeader = req.headers.authorization;
      const tokenFromAuth =
        authHeader && authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : undefined;
      const tokenFromCookie = cookies.ocmc_github_token
        ? decodeURIComponent(cookies.ocmc_github_token)
        : undefined;
      const githubToken = tokenFromAuth || tokenFromCookie;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      fetch(targetUrl.toString(), {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "openclaw-mc/asset-proxy",
          Accept: "image/*,*/*;q=0.8",
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
        },
      })
        .then((upstream) => {
          clearTimeout(timeout);

          if (!upstream.ok || !upstream.body) {
            res.writeHead(upstream.status || 502, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error:
                  upstream.status === 401 || upstream.status === 403
                    ? "GitHub denied access to this asset"
                    : "Failed to fetch GitHub asset",
              })
            );
            return;
          }

          const contentType = upstream.headers.get("content-type") || "application/octet-stream";
          const cacheControl = upstream.headers.get("cache-control") || "public, max-age=3600";

          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": cacheControl,
          });

          pipeline(upstream.body as unknown as NodeJS.ReadableStream, res, (err) => {
            if (err) {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to stream GitHub asset" }));
              } else {
                res.end();
              }
            }
          });
        })
        .catch((err) => {
          clearTimeout(timeout);
          const isAbortError = err instanceof Error && err.name === "AbortError";
          res.writeHead(isAbortError ? 504 : 502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: isAbortError ? "Timed out while fetching GitHub asset" : "Failed to fetch GitHub asset",
            })
          );
        });

      return;
    }

    // VSCode open endpoint – used by extension panels to open a PR branch
    // locally (desktop) or fall back to vscode.dev (remote/CI environments).
    if (
      req.method === "POST" &&
      (parsedUrl.pathname === "/api/vscode/select-folder" ||
        parsedUrl.pathname === "/mission-controle/api/vscode/select-folder")
    ) {
      VsCodeService.selectFolder()
        .then((result) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: (err as Error).message || "Internal server error" }));
        });
      return;
    }

    // VSCode open endpoint – used by extension panels to open a PR branch
    // locally (desktop) or fall back to vscode.dev (remote/CI environments).
    if (
      req.method === "POST" &&
      (parsedUrl.pathname === "/api/vscode/open" ||
        parsedUrl.pathname === "/mission-controle/api/vscode/open")
    ) {
      const MAX_BODY = 64 * 1024; // 64 KB – more than enough for the three string fields
      let body = "";
      let bodySize = 0;
      let aborted = false;
      req.on("data", (chunk: Buffer) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY) {
          aborted = true;
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request body too large" }));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });
      req.on("end", async () => {
        if (aborted) return;
        try {
          const { cloneUrl, fullName, branch, selectedPath } = JSON.parse(body);
          if (!cloneUrl || !fullName || !branch) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "cloneUrl, fullName, and branch are required" }));
            return;
          }
          const result = await VsCodeService.open(cloneUrl, fullName, branch, {
            selectedPath: typeof selectedPath === "string" ? selectedPath : undefined,
            configManager,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: (err as Error).message || "Internal server error" }));
        }
      });
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
