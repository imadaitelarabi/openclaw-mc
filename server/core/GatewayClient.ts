/**
 * Gateway Client
 * Robust wrapper for OpenClaw Gateway WebSocket connection
 * Handles RPC calls, events, authentication, and reconnection
 */

import WebSocket from 'ws';
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
  PendingRequest,
  ConnectWaiter,
  ExtendedWebSocket,
  TransformedAgent,
} from '../types/internal';
import { ConfigManager } from './ConfigManager';

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
  private connectWaiters: ConnectWaiter[] = [];
  private configManager: ConfigManager;
  private debugGatewayEvents: boolean = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.updateFromConfig();
    // Read DEBUG_GATEWAY_EVENTS from environment
    this.debugGatewayEvents = process.env.DEBUG_GATEWAY_EVENTS === 'true';
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
        if (
          msg?.type === 'res' &&
          msg?.ok === true &&
          msg?.payload?.sessions &&
          Array.isArray(msg.payload.sessions)
        ) {
          console.log(
            `[Gateway] Received sessions response: ${msg.payload.sessions.length} sessions`
          );
        } else {
          console.log('[Gateway] Received message:', JSON.stringify(msg, null, 2));
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
        caps: ["tool-events"],
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

      // Fetch sessions to determine active runs
      const sessions = await this.request('sessions.list', {});
      this.transformAndBroadcastSessions(sessions);

      // Fetch recent chat history for each agent (last 20 messages)
      console.log('[Gateway] Fetching chat history for agents...');
      const historyPromises = this.agentsList.map(async (agent) => {
        const sessionKey = `agent:${agent.id}:main`;
        try {
          const messages = await this.fetchChatHistory(sessionKey, 20);
          return { agentId: agent.id, messages };
        } catch (err) {
          console.error(`[Gateway] Failed to fetch history for ${agent.id}:`, err);
          return { agentId: agent.id, messages: [] };
        }
      });

      const histories = await Promise.all(historyPromises);
      
      // Broadcast chat history to clients
      histories.forEach(({ agentId, messages }) => {
        if (messages.length > 0) {
          console.log(`[Gateway] Broadcasting ${messages.length} messages for agent ${agentId}`);
          this.broadcast({
            type: 'chat_history',
            agentId,
            messages,
          });
        }
      });
    } catch (err) {
      console.error('[Gateway] Failed to fetch initial data:', err);
    }
  }

  private getAgentName(id: string): string {
    const agent = this.agentsList.find((a) => a.id === id);
    return agent ? agent.name : id;
  }

  
  private async handleGatewayEvent(msg: GatewayEvent): Promise<void> {



    // 2. Broadcast ALL events to connected clients (Thin Proxy approach)
    this.broadcast({
      type: 'event',
      event: msg.event,
      payload: msg.payload,
    });
  }

  private transformAndBroadcastSessions(data: any): void {
    if (!data?.sessions) return;

    const activeSessions = new Set<string>();
    data.sessions.forEach((s: Session) => {
      const parts = s.key.split(':');
      if (parts.length >= 2) activeSessions.add(parts[1]);
    });

    const agents: TransformedAgent[] = this.agentsList.map((a) => ({
      id: a.id,
      name: a.name,
      identity: a.identityName,
      emoji: a.identityEmoji,
      status: activeSessions.has(a.id) ? 'active' : 'idle',
      model: a.model,
    }));

    this.broadcast({ type: 'agents', data: agents });
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

  /**
   * Generic gateway RPC call - allows UI to call any Gateway method
   * without needing a specific server-side handler
   */
  async call(method: string, params: any = {}): Promise<any> {
    return this.request(method, params);
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

  /**
   * Fetch chat history from Gateway
   * @param sessionKey - Session key (e.g., "agent:agentId:main")
   * @param limit - Number of messages to fetch (default: 20)
   * @param before - Message ID to paginate from (optional)
   * @returns Array of chat messages
   */
  async fetchChatHistory(
    sessionKey: string,
    limit: number = 20,
    before?: string
  ): Promise<any[]> {
    try {
      const params: Record<string, unknown> = {
        sessionKey,
        limit,
      };
      
      if (before) {
        params.before = before;
      }

      const response = await this.request('chat.history', params);
      return Array.isArray(response) ? response : response?.messages || [];
    } catch (err) {
      console.error(`[Gateway] Failed to fetch chat history for ${sessionKey}:`, err);
      return [];
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
