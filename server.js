require('dotenv').config({ path: '.env.local', override: true });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Data persistence paths
const DATA_DIR = path.join(__dirname, 'data');
const ACTIVITY_LOG_PATH = path.join(DATA_DIR, 'activity-history.json');
const CONFIG_DIR = path.join(process.env.HOME || '/root', '.oc-mission-control');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Ensure directories exist
[DATA_DIR, CONFIG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class ConfigManager {
  constructor() {
    this.config = { gateways: [], activeGatewayId: null };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      } else {
        // Migration/Initial setup from ENV
        const envUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
        const envToken = process.env.OPENCLAW_GATEWAY_TOKEN;
        if (envToken) {
          const id = uuidv4();
          this.config.gateways.push({
            id,
            name: 'Local Gateway',
            url: envUrl.replace(/^http/, 'ws'),
            token: envToken,
            isLocal: true
          });
          this.config.activeGatewayId = id;
          this.save();
        }
      }
    } catch (err) {
      console.error('[Config] Failed to load config:', err);
    }
  }

  save() {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error('[Config] Failed to save config:', err);
    }
  }

  getGateways() {
    return this.config.gateways.map(g => ({ ...g, token: '********' }));
  }

  getActiveGateway() {
    return this.config.gateways.find(g => g.id === this.config.activeGatewayId);
  }

  addGateway(name, url, token) {
    const id = uuidv4();
    const newGateway = { id, name, url: url.replace(/^http/, 'ws'), token, isLocal: false };
    this.config.gateways.push(newGateway);
    this.config.activeGatewayId = id;
    this.save();
    return newGateway;
  }

  switchGateway(id) {
    if (this.config.gateways.find(g => g.id === id)) {
      this.config.activeGatewayId = id;
      this.save();
      return true;
    }
    return false;
  }

  removeGateway(id) {
    this.config.gateways = this.config.gateways.filter(g => g.id !== id);
    if (this.config.activeGatewayId === id) {
      this.config.activeGatewayId = this.config.gateways[0]?.id || null;
    }
    this.save();
  }
}

const configManager = new ConfigManager();

// Gateway WebSocket connection manager
class GatewayConnection {
  constructor() {
    this.url = null;
    this.token = null;
    this.activeId = null;
    this.ws = null;
    this.pending = new Map();
    this.authenticated = false;
    this.clients = new Set();
    this.reconnectTimer = null;
    this.agentsList = [];
    this.activityLog = []; // In-memory activity log
    this.saveTimer = null; // Debounce timer for saving

    this.loadActivityLog();
    this.updateFromConfig();
  }

  updateFromConfig() {
    const active = configManager.getActiveGateway();
    if (active) {
      this.url = active.url;
      this.token = active.token;
      this.activeId = active.id;
    } else {
      this.url = null;
      this.token = null;
      this.activeId = null;
    }
  }

  switch(id) {
    if (configManager.switchGateway(id)) {
      this.ws?.close();
      this.updateFromConfig();
      this.connect();
      return true;
    }
    return false;
  }

  loadActivityLog() {
    try {
      if (fs.existsSync(ACTIVITY_LOG_PATH)) {
        const data = fs.readFileSync(ACTIVITY_LOG_PATH, 'utf8');
        this.activityLog = JSON.parse(data);
        console.log(`[Persistence] Loaded ${this.activityLog.length} activities`);
      }
    } catch (err) {
      console.error('[Persistence] Failed to load activity log:', err);
      this.activityLog = [];
    }
  }

  saveActivityLog() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    
    this.saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(ACTIVITY_LOG_PATH, JSON.stringify(this.activityLog, null, 2));
        console.log('[Persistence] Saved activity log');
      } catch (err) {
        console.error('[Persistence] Failed to save activity log:', err);
      }
    }, 2000); // Debounce saves by 2 seconds
  }

  connect() {
    if (!this.url) {
      console.log('[Gateway] No gateway configured');
      this.broadcast({ type: 'status', status: 'no-config' });
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) return;

    console.log('[Gateway] Connecting to:', this.url);
    this.broadcast({ type: 'status', status: 'connecting', gatewayId: this.activeId });
    this.ws = new WebSocket(this.url, {
      headers: {
        'Origin': 'http://localhost:3001'
      }
    });

    this.ws.on('open', () => {
      console.log('[Gateway] Connected');
      this.authenticated = false;
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'event') {
             console.log(`[Gateway] Event: ${msg.event} (stream: ${msg.payload?.stream})`);
        }
        this.handleGatewayMessage(msg);
      } catch (err) {
        console.error('[Gateway] Failed to parse message:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[Gateway] Closed: ${code} - ${reason}`);
      this.authenticated = false;
      this.ws = null;
      
      this.broadcast({ type: 'status', status: 'disconnected' });
      
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('[Gateway] Error:', err.message);
    });
  }

  async handleGatewayMessage(msg) {
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      console.log('[Gateway] Received challenge:', JSON.stringify(msg.payload));
      await this.authenticate(msg.payload);
      return;
    }

    if (msg.type === 'res' && msg.id) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        if (msg.ok) {
          pending.resolve(msg.payload);
        } else {
          pending.reject(new Error(msg.error?.message || 'Request failed'));
        }
      }
      return;
    }

    if (msg.type === 'event') {
      await this.handleGatewayEvent(msg);
    }
  }

  async authenticate(challenge) {
    try {
      const connectParams = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: '2.0.0',
          platform: 'node',
          mode: 'ui',
          instanceId: uuidv4()
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals', 'operator.pairing'],
        auth: {
          token: this.token
        },
        caps: [],
        userAgent: 'Mission-Control/2.0',
        locale: 'en-US'
      };
      
      console.log('[Gateway] Sending connect request (token auth)');
      const response = await this.request('connect', connectParams);

      this.authenticated = true;
      console.log('[Gateway] Authenticated successfully');
      
      this.broadcast({ type: 'status', status: 'connected' });
      await this.fetchInitialData();
    } catch (err) {
      console.error('[Gateway] Authentication failed:', err);
      this.ws?.close(4008, 'Authentication failed');
    }
  }

  async fetchInitialData() {
    try {
      // Fetch Agents List first
      const agents = await this.request('agents.list', {});
      this.agentsList = Array.isArray(agents) ? agents : (agents.agents || []);
      
      // Send Agent Definitions to client
      this.broadcast({ type: 'agent_definitions', data: this.agentsList });

      // Then fetch sessions
      const sessions = await this.request('sessions.list', {});
      this.transformAndBroadcastSessions(sessions);
    } catch (err) {
      console.error('[Gateway] Failed to fetch initial data:', err);
    }
  }

  getAgentName(id) {
    const agent = this.agentsList.find(a => a.id === id);
    return agent ? agent.name : id;
  }

  async handleGatewayEvent(msg) {
    // Forward raw events to clients for chat UI
    if (msg.event === 'chat' || msg.event === 'agent') {
        if (msg.event === 'agent' && msg.payload.stream === 'tool') {
            console.log(`[Gateway] TOOL EVENT DETECTED:`, JSON.stringify(msg.payload, null, 2));
        }
        this.broadcast({
            type: 'event', // Raw event wrapper
            event: msg.event,
            payload: msg.payload
        });
    }

    switch (msg.event) {
      case 'chat':
      case 'agent':
        if (msg.payload?.sessionKey) {
          const parts = (msg.payload.sessionKey || '').split(':');
          const agentId = parts.length >= 2 ? parts[1] : 'unknown';
          const agentName = this.getAgentName(agentId);
          
          let messageText = `${msg.event} activity`;
          if (msg.event === 'agent' && msg.payload.tool) {
            messageText = `Used tool: ${msg.payload.tool}`;
          } else if (msg.event === 'chat') {
            messageText = `Chat message`;
          }

          const activity = {
            id: uuidv4(),
            agentId: agentId,
            agentName: agentName,
            message: messageText,
            timestamp: Date.now(),
            type: msg.event
          };

          // Add to log and persist
          this.activityLog.unshift(activity);
          if (this.activityLog.length > 500) {
            this.activityLog = this.activityLog.slice(0, 500);
          }
          this.saveActivityLog();

          // Broadcast to connected clients
          this.broadcast({
            type: 'activity',
            data: activity
          });
        }
        break;

      case 'cron':
        await this.fetchInitialData();
        break;
    }
  }

  transformAndBroadcastSessions(data) {
    if (!data?.sessions) return;

    const activeSessions = new Set();
    data.sessions.forEach(s => {
        if (s.kind !== 'cron') {
            const parts = s.key.split(':');
            if (parts.length >= 2) activeSessions.add(parts[1]);
        }
    });

    const agents = this.agentsList.map(a => ({
        id: a.id,
        name: a.name,
        identity: a.identityName,
        emoji: a.identityEmoji,
        status: activeSessions.has(a.id) ? 'active' : 'idle',
        model: a.model
    }));

    const crons = data.sessions
      .filter(s => s.kind === 'cron')
      .map(s => ({
        id: s.sessionId,
        name: s.key.split(':').pop() || 'Unknown',
        schedule: 'Active',
        status: s.abortedLastRun ? 'error' : 'active'
      }));

    this.broadcast({ type: 'agents', data: agents });
    this.broadcast({ type: 'crons', data: crons });
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = uuidv4();
      this.pending.set(id, { resolve, reject });

      this.ws.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params
      }));

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async sendChat(agentId, message) {
    // Find active session for this agent
    let sessionKey = `agent:${agentId}:main`;
    
    // Look up in recent sessions if possible, otherwise default
    // We don't have easy access to sessions list here without caching it
    // But we can just try the default.
    
    console.log(`[Chat] Sending to ${sessionKey}: ${message.substring(0, 50)}...`);
    
    try {
        const res = await this.request('chat.send', {
            sessionKey: sessionKey,
            message: message,
            deliver: true, // Ensure it delivers to the session
            idempotencyKey: uuidv4()
        });
        console.log(`[Chat] Sent successfully. RunID: ${res?.runId}`);
        return { ok: true };
    } catch (err) {
        console.error(`[Chat] Failed to send to ${sessionKey}:`, err);
        return { ok: false, error: err.message };
    }
  }

  addClient(client) {
    this.clients.add(client);
    
    if (this.authenticated) {
      client.send(JSON.stringify({ type: 'status', status: 'connected' }));
      
      // Send initial data
      if (this.agentsList.length > 0) {
        this.broadcast({ type: 'agent_definitions', data: this.agentsList });
        this.fetchInitialData(); 
      }

      // Send activity history
      if (this.activityLog.length > 0) {
        client.send(JSON.stringify({
          type: 'activities',
          data: this.activityLog.slice(0, 100) // Send last 100 on connect
        }));
      }
    } else {
      client.send(JSON.stringify({ type: 'status', status: 'connecting' }));
    }
  }

  removeClient(client) {
    this.clients.delete(client);
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  startPolling() {
    setInterval(async () => {
      if (this.authenticated) {
        try {
          const sessions = await this.request('sessions.list', {});
          this.transformAndBroadcastSessions(sessions);
        } catch (err) {
          console.error('[Gateway] Polling error:', err);
        }
      }
    }, 2000);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  // WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  
  // Initialize Gateway connection
  const sessionPatches = new Map();
  const gateway = new GatewayConnection();

  gateway.connect();
  gateway.startPolling();

  // Handle WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    
    // Check for both paths to support local dev and production
    if (pathname === '/api/ws' || pathname === '/mission-controle/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        console.log('[Client] New WebSocket connection');
        
        gateway.addClient(ws);

        ws.on('message', async (data) => {
          console.log('[Client] Message:', data.toString());
          try {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            } else if (msg.type === 'gateways.list') {
              ws.send(JSON.stringify({ 
                type: 'gateways.list', 
                data: configManager.getGateways(),
                activeId: configManager.config.activeGatewayId
              }));
            } else if (msg.type === 'gateways.add') {
              const { name, url, token } = msg;
              configManager.addGateway(name, url, token);
              gateway.ws?.close();
              gateway.updateFromConfig();
              gateway.connect();
              ws.send(JSON.stringify({ type: 'gateways.add.ack' }));
            } else if (msg.type === 'gateways.switch') {
              gateway.switch(msg.id);
              ws.send(JSON.stringify({ type: 'gateways.switch.ack' }));
            } else if (msg.type === 'gateways.remove') {
              configManager.removeGateway(msg.id);
              gateway.ws?.close();
              gateway.updateFromConfig();
              gateway.connect();
              ws.send(JSON.stringify({ type: 'gateways.remove.ack' }));
            } else if (msg.type === 'chat.send') {
              // Handle chat messages from client
              if (msg.agentId && msg.message) {
                await gateway.sendChat(msg.agentId, msg.message);
              }
            } else if (msg.type === 'models.list') {
              // Get models list from Gateway
              try {
                const models = await gateway.request('models.list', {});
                console.log(`[Gateway] Sending models list: ${(models.models || []).length} models`);
                ws.send(JSON.stringify({ type: 'models', data: models }));
              } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
              }
            } else if (msg.type === 'sessions.list') {
              // Get sessions list from Gateway
              try {
                const sessions = await gateway.request('sessions.list', {});
                // Merge patches
                if (sessions.sessions) {
                  sessions.sessions.forEach(s => {
                    const patch = sessionPatches.get(s.key);
                    if (patch) Object.assign(s, patch);
                  });
                }
                ws.send(JSON.stringify({ type: 'sessions', data: sessions }));
              } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
              }
            } else if (msg.type === 'sessions.patch') {
              // Update session settings
              try {
                const { sessionKey, type, thinking, verbose, reasoning, model, modelProvider, ...rest } = msg;
                
                // Map frontend names to gateway schema names
                const patch = { ...rest };
                if (thinking !== undefined) patch.thinkingLevel = thinking;
                if (verbose !== undefined) patch.verboseLevel = verbose;
                if (reasoning !== undefined) patch.reasoningLevel = reasoning;
                
                // Gateway expects model as "provider/model" string or alias
                if (model !== undefined) {
                  if (modelProvider) {
                    patch.model = `${modelProvider}/${model}`;
                  } else {
                    patch.model = model;
                  }
                }

                console.log(`[Client] Patching session ${sessionKey}:`, patch);
                
                // Track in server-side map for polling consistency
                sessionPatches.set(sessionKey, { ...sessionPatches.get(sessionKey) || {}, ...patch });
                
                // Forward to Gateway
                const gatewayRes = await gateway.request('sessions.patch', { key: sessionKey, ...patch });
                console.log(`[Gateway] Patch response:`, gatewayRes);
                
                ws.send(JSON.stringify({ type: 'sessions.patch.ack' }));
                
                // Broadcast updated sessions to all clients immediately
                const sessions = await gateway.request('sessions.list', {});
                // Merge patches
                if (sessions.sessions) {
                  sessions.sessions.forEach(s => {
                    const p = sessionPatches.get(s.key);
                    if (p) Object.assign(s, p);
                  });
                }
                gateway.broadcast({ type: 'sessions', data: sessions });
              } catch (err) {
                console.error('[Client] Patch failed:', err);
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
              }
            }
          } catch (err) {
            console.error('[Client] Failed to parse message:', err);
          }
        });

        ws.on('close', () => {
          console.log('[Client] WebSocket closed');
          gateway.removeClient(ws);
        });

        ws.on('error', (err) => {
          console.error('[Client] WebSocket error:', err);
        });
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Gateway: ${gateway.url || 'None'}`);
  });
});
