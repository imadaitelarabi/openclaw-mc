/**
 * Gateway Client
 * Robust wrapper for OpenClaw Gateway WebSocket connection
 * Handles RPC calls, events, authentication, and reconnection
 */

import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayEvent,
  ConnectParams,
  Agent,
  Session,
} from '../types/gateway';
import type {
  Activity,
  PendingRequest,
  ConnectWaiter,
  ExtendedWebSocket,
  TransformedAgent,
  CronJob,
} from '../types/internal';
import { ConfigManager } from './ConfigManager';
import { processEvent } from '../utils/event-processor';

// Use process.cwd() for project root instead of relative paths from __dirname
const DATA_DIR = path.join(process.cwd(), 'data');
const ACTIVITY_LOG_PATH = path.join(DATA_DIR, 'activity-history.json');

export class GatewayClient {
  private url: string | null = null;
  private token: string | null = null;
  private activeId: string | null = null;
  private ws: WebSocket | null = null;
  private pending: Map<string, PendingRequest> = new Map();
  private authenticated: boolean = false;
  private clients: Set<ExtendedWebSocket> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private agentsList: Agent[] = [];
  private activityLog: Activity[] = [];
  private saveTimer: NodeJS.Timeout | null = null;
  private connectWaiters: ConnectWaiter[] = [];
  private configManager: ConfigManager;
  private debugGatewayEvents: boolean = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.ensureDataDir();
    this.loadActivityLog();
    this.updateFromConfig();
    // Read DEBUG_GATEWAY_EVENTS from environment
    this.debugGatewayEvents = process.env.DEBUG_GATEWAY_EVENTS === 'true';
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadActivityLog(): void {
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

  private saveActivityLog(): void {
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

  updateFromConfig(): void {
    const active = this.configManager.getActiveGateway();
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

  switch(id: string): boolean {
    if (this.configManager.switchGateway(id)) {
      this.ws?.close();
      this.updateFromConfig();
      this.connect();
      return true;
    }
    return false;
  }

  private resolveConnectWaiters(error: Error | null = null): void {
    if (this.connectWaiters.length === 0) return;

    const waiters = [...this.connectWaiters];
    this.connectWaiters = [];

    waiters.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  }

  waitForAuthenticated(timeoutMs: number = 15000): Promise<void> {
    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.connectWaiters = this.connectWaiters.filter((w) => w !== waiter);
        reject(new Error('Gateway connection timeout'));
      }, timeoutMs);

      const waiter: ConnectWaiter = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
      };

      this.connectWaiters.push(waiter);
    });
  }

  connect(): void {
    if (!this.url) {
      console.log('[Gateway] No gateway configured');
      this.broadcast({ type: 'status', status: 'no-config' });
      this.resolveConnectWaiters(new Error('No gateway configured'));
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) return;

    console.log('[Gateway] Connecting to:', this.url);
    this.broadcast({ type: 'status', status: 'connecting', gatewayId: this.activeId || undefined });
    this.ws = new WebSocket(this.url, {
      headers: {
        Origin: 'http://localhost:3001',
      },
    });

    this.ws.on('open', () => {
      console.log('[Gateway] Connected');
      this.authenticated = false;
    });

    this.ws.on('message', (data: WebSocket.Data) => {
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

    this.ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[Gateway] Closed: ${code} - ${reason.toString()}`);
      this.authenticated = false;
      this.ws = null;
      this.resolveConnectWaiters(new Error(`Gateway connection closed (${code})`));

      this.broadcast({ type: 'status', status: 'disconnected' });

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err: Error) => {
      console.error('[Gateway] Error:', err.message);
      this.resolveConnectWaiters(new Error(err.message || 'Gateway connection error'));
    });
  }

  private async handleGatewayMessage(msg: GatewayResponse | GatewayEvent): Promise<void> {
    if (msg.type === 'event' && (msg as GatewayEvent).event === 'connect.challenge') {
      console.log('[Gateway] Received challenge:', JSON.stringify((msg as GatewayEvent).payload));
      await this.authenticate((msg as GatewayEvent).payload);
      return;
    }

    if (msg.type === 'res' && (msg as GatewayResponse).id) {
      const response = msg as GatewayResponse;
      const pending = this.pending.get(response.id);
      if (pending) {
        this.pending.delete(response.id);
        if (response.ok) {
          pending.resolve(response.payload);
        } else {
          pending.reject(new Error(response.error?.message || 'Request failed'));
        }
      }
      return;
    }

    if (msg.type === 'event') {
      await this.handleGatewayEvent(msg as GatewayEvent);
    }
  }

  private async authenticate(challenge: any): Promise<void> {
    try {
      const connectParams: ConnectParams = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: '2.0.0',
          platform: 'node',
          mode: 'ui',
          instanceId: uuidv4(),
        },
        role: 'operator',
        scopes: [
          'operator.read',
          'operator.write',
          'operator.admin',
          'operator.approvals',
          'operator.pairing',
        ],
        auth: {
          token: this.token!,
        },
        caps: [],
        userAgent: 'Mission-Control/2.0',
        locale: 'en-US',
      };

      console.log('[Gateway] Sending connect request (token auth)');
      const response = await this.request('connect', connectParams);

      this.authenticated = true;
      console.log('[Gateway] Authenticated successfully');
      this.resolveConnectWaiters();

      this.broadcast({ type: 'status', status: 'connected' });
      await this.fetchInitialData();
    } catch (err) {
      console.error('[Gateway] Authentication failed:', err);
      this.resolveConnectWaiters(
        new Error((err as Error).message || 'Authentication failed')
      );
      this.ws?.close(4008, 'Authentication failed');
    }
  }

  async fetchInitialData(): Promise<void> {
    try {
      // Fetch Agents List first
      const agents = await this.request('agents.list', {});
      this.agentsList = Array.isArray(agents) ? agents : agents.agents || [];

      // Send Agent Definitions to client
      this.broadcast({ type: 'agent_definitions', data: this.agentsList });

      // Then fetch sessions
      const sessions = await this.request('sessions.list', {});
      this.transformAndBroadcastSessions(sessions);
    } catch (err) {
      console.error('[Gateway] Failed to fetch initial data:', err);
    }
  }

  private getAgentName(id: string): string {
    const agent = this.agentsList.find((a) => a.id === id);
    return agent ? agent.name : id;
  }

  /**
   * Log Gateway Event with comprehensive details
   * Captures event name, run ID, session key, payload size, and timestamp
   */
  private logGatewayEvent(msg: GatewayEvent): void {
    const timestamp = new Date().toISOString();
    const eventName = msg.event;
    const payload = msg.payload || {};
    
    // Extract key identifiers from payload
    const runId = payload.runId || payload.run_id || null;
    const sessionKey = payload.sessionKey || payload.session_key || null;
    
    // Calculate payload size (compact stringification)
    const payloadSize = JSON.stringify(payload).length;
    
    // Basic log entry (always shown)
    const logEntry = {
      timestamp,
      event: eventName,
      runId,
      sessionKey,
      payloadSize: `${payloadSize} bytes`,
    };
    
    console.log(`[Gateway Event] ${JSON.stringify(logEntry)}`);
    
    // Detailed payload logging with pretty-printing (only if DEBUG_GATEWAY_EVENTS is enabled)
    // Note: We stringify twice here for clarity: once for size (compact), once for readability (formatted)
    if (this.debugGatewayEvents) {
      console.log(`[Gateway Event Payload] ${eventName}:`, JSON.stringify(payload, null, 2));
    }
  }

  private async handleGatewayEvent(msg: GatewayEvent): Promise<void> {
    // 1. Log all gateway events with comprehensive details
    this.logGatewayEvent(msg);

    // 2. Broadcast ALL events to connected clients (Inclusive approach)
    this.broadcast({
      type: 'event',
      event: msg.event,
      payload: msg.payload,
    });

    // 3. Process specific events through the pipeline for enhanced formatting
    if (msg.event === 'chat' || msg.event === 'agent') {
      if (msg.event === 'agent' && msg.payload.stream === 'tool') {
        console.log(`[Gateway] TOOL EVENT DETECTED:`, JSON.stringify(msg.payload, null, 2));
      }
      
      // Process event through pipeline
      const processed = processEvent(msg.event, msg.payload);
      
      // Forward processed event with formatted messages
      if (processed.formattedMessages.length > 0 || processed.thinkingDelta) {
        this.broadcast({
          type: 'event.processed',
          eventType: processed.type,
          agentId: processed.agentId,
          runId: processed.runId,
          sessionKey: processed.sessionKey,
          formattedMessages: processed.formattedMessages,
          thinkingDelta: processed.thinkingDelta,
          thinkingComplete: processed.thinkingComplete,
        });
      }
    }

    // 4. Handle specific event types for internal processing
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

          const activity: Activity = {
            id: uuidv4(),
            agentId: agentId,
            agentName: agentName,
            message: messageText,
            timestamp: Date.now(),
            type: msg.event,
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
            data: activity,
          });
        }
        break;

      case 'cron':
        // Refresh data when cron events occur
        await this.fetchInitialData();
        break;
    }
  }

  private transformAndBroadcastSessions(data: any): void {
    if (!data?.sessions) return;

    const activeSessions = new Set<string>();
    data.sessions.forEach((s: Session) => {
      if (s.kind !== 'cron') {
        const parts = s.key.split(':');
        if (parts.length >= 2) activeSessions.add(parts[1]);
      }
    });

    const agents: TransformedAgent[] = this.agentsList.map((a) => ({
      id: a.id,
      name: a.name,
      identity: a.identityName,
      emoji: a.identityEmoji,
      status: activeSessions.has(a.id) ? 'active' : 'idle',
      model: a.model,
    }));

    const crons: CronJob[] = data.sessions
      .filter((s: Session) => s.kind === 'cron')
      .map((s: Session) => ({
        id: s.sessionId,
        name: s.key.split(':').pop() || 'Unknown',
        schedule: 'Active',
        status: s.abortedLastRun ? 'error' : 'active',
      }));

    this.broadcast({ type: 'agents', data: agents });
    this.broadcast({ type: 'crons', data: crons });
  }

  request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = uuidv4();
      this.pending.set(id, { resolve, reject });

      const request: GatewayRequest = {
        type: 'req',
        id,
        method,
        params,
      };

      this.ws.send(JSON.stringify(request));

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async sendChat(agentId: string, message: string): Promise<{ ok: boolean; error?: string }> {
    // Find active session for this agent
    const sessionKey = `agent:${agentId}:main`;

    console.log(`[Chat] Sending to ${sessionKey}: ${message.substring(0, 50)}...`);

    try {
      const res = await this.request('chat.send', {
        sessionKey: sessionKey,
        message: message,
        deliver: true,
        idempotencyKey: uuidv4(),
      });
      console.log(`[Chat] Sent successfully. RunID: ${res?.runId}`);
      return { ok: true };
    } catch (err) {
      console.error(`[Chat] Failed to send to ${sessionKey}:`, err);
      return { ok: false, error: (err as Error).message };
    }
  }

  addClient(client: ExtendedWebSocket): void {
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
        client.send(
          JSON.stringify({
            type: 'activities',
            data: this.activityLog.slice(0, 100), // Send last 100 on connect
          })
        );
      }
    } else {
      client.send(JSON.stringify({ type: 'status', status: 'connecting' }));
    }
  }

  removeClient(client: ExtendedWebSocket): void {
    this.clients.delete(client);
  }

  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  startPolling(): void {
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

  getUrl(): string | null {
    return this.url;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }
}
