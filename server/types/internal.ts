/**
 * Internal Server Type Definitions
 * Types for internal server state and client communication
 */

import type { Agent, Session, ModelsListResponse } from './gateway';
import type WebSocket from 'ws';

// Gateway Configuration
export interface GatewayConfig {
  id: string;
  name: string;
  url: string;
  token: string;
  isLocal?: boolean;
}

export interface ServerConfig {
  gateways: GatewayConfig[];
  activeGatewayId: string | null;
}

// Client WebSocket Messages
export type ClientMessage =
  | { type: 'ping' }
  | { type: 'gateways.list' }
  | { type: 'gateways.add'; name: string; url: string; token: string }
  | { type: 'gateways.switch'; id: string }
  | { type: 'gateways.remove'; id: string }
  | { type: 'gateway.call'; method: string; params?: Record<string, unknown>; requestId?: string }
  | { type: 'chat.send'; agentId: string; message: string }
  | {
      type: 'chat.history.load';
      agentId: string;
      params: {
        sessionKey: string;
        limit?: number;
        before?: string;
      };
    }
  | { type: 'chat.abort.run'; agentId: string }
  | { type: 'models.list' }
  | { type: 'sessions.list' }
  | {
      type: 'sessions.patch';
      sessionKey: string;
      thinking?: number;
      verbose?: number;
      reasoning?: number;
      model?: string;
      modelProvider?: string;
    }
  | {
      type: 'agents.add';
      requestId?: string;
      id?: string;
      name: string;
      workspace?: string;
      model?: string;
      tools?: string[];
      sandbox?: Record<string, unknown>;
    }
  | {
      type: 'agents.update';
      requestId?: string;
      agentId: string;
      name: string;
    }
  | {
      type: 'agents.delete';
      requestId?: string;
      agentId: string;
    };

// Server to Client Messages
export type ServerMessage =
  | { type: 'pong' }
  | { type: 'status'; status: string; gatewayId?: string }
  | { type: 'gateways.list'; data: GatewayConfig[]; activeId: string | null }
  | { type: 'gateways.add.ack' }
  | { type: 'gateways.switch.ack' }
  | { type: 'gateways.remove.ack' }
  | { type: 'gateway.call.response'; requestId?: string; result: unknown }
  | { type: 'gateway.call.error'; requestId?: string; error: string }
  | { type: 'error'; message: string; requestId?: string }
  | { type: 'agents'; data: TransformedAgent[] }
  | { type: 'agent_definitions'; data: Agent[] }
  | { type: 'sessions'; data: { sessions: Session[] } }
  | { type: 'sessions.patch.ack' }
  | { type: 'models'; data: ModelsListResponse }
  | { type: 'agents.add.ack'; requestId?: string; agentId: string }
  | { type: 'agents.update.ack'; requestId?: string; agentId: string; name: string }
  | { type: 'agents.delete.ack'; requestId?: string; agentId: string; removed: boolean }
  | { type: 'chat_history'; agentId: string; messages: unknown[] }
  | { type: 'chat_history_more'; agentId: string; messages: unknown[]; before?: string }
  | { type: 'event'; event: string; payload: Record<string, unknown> };

// Transformed types for client display
export interface TransformedAgent {
  id: string;
  name: string;
  identity?: string;
  emoji?: string;
  status: 'active' | 'idle';
  model?: string;
}

// WebSocket Client with custom properties
export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

// Gateway Connection State
export interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

export interface ConnectWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
}
