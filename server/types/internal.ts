/**
 * Internal Server Type Definitions
 * Types for internal server state and client communication
 */

import type { Agent, Session } from './gateway';
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

// Activity Log
export interface Activity {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  timestamp: number;
  type: string;
}

// Client WebSocket Messages
export type ClientMessage =
  | { type: 'ping' }
  | { type: 'gateways.list' }
  | { type: 'gateways.add'; name: string; url: string; token: string }
  | { type: 'gateways.switch'; id: string }
  | { type: 'gateways.remove'; id: string }
  | { type: 'gateway.call'; method: string; params?: any; requestId?: string }
  | { type: 'chat.send'; agentId: string; message: string }
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
      sandbox?: any;
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
  | { type: 'gateway.call.response'; requestId?: string; result: any }
  | { type: 'gateway.call.error'; requestId?: string; error: string }
  | { type: 'error'; message: string; requestId?: string }
  | { type: 'agents'; data: TransformedAgent[] }
  | { type: 'agent_definitions'; data: Agent[] }
  | { type: 'crons'; data: CronJob[] }
  | { type: 'sessions'; data: { sessions: Session[] } }
  | { type: 'sessions.patch.ack' }
  | { type: 'models'; data: any }
  | { type: 'agents.add.ack'; requestId?: string; agentId: string }
  | { type: 'agents.update.ack'; requestId?: string; agentId: string; name: string }
  | { type: 'agents.delete.ack'; requestId?: string; agentId: string; removed: boolean }
  | { type: 'activity'; data: Activity }
  | { type: 'activities'; data: Activity[] }
  | { type: 'event'; event: string; payload: any };

// Transformed types for client display
export interface TransformedAgent {
  id: string;
  name: string;
  identity?: string;
  emoji?: string;
  status: 'active' | 'idle';
  model?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  status: 'active' | 'error';
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
