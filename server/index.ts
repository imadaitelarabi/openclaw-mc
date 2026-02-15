/**
 * Server Entry Point
 * Initializes Next.js, HTTP server, WebSocket server, and Gateway connection
 */

require('dotenv').config({ path: '.env.local', override: true });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { ConfigManager } from './core/ConfigManager';
import { GatewayClient } from './core/GatewayClient';
import { WebSocketServer } from './core/WebSocketServer';
import { configManager } from './handlers';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Cache package version for health checks
const packageVersion = require('../../package.json').version;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    // Health check endpoint
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/api/health') {
      const gateway = configManager.getActiveGateway();
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mission-control',
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthStatus, null, 2));
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

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Gateway: ${gateway.getUrl() || 'None'}`);
  });
});
