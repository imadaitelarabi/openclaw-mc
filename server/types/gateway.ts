/**
 * Gateway WebSocket Protocol Type Definitions
 * Types for OpenClaw Gateway RPC requests and responses
 */

export interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    message: string;
    code?: string;
  };
}

export interface GatewayEvent {
  type: 'event';
  event: string;
  payload: Record<string, unknown>;
}

// Connect Protocol
export interface ConnectChallenge {
  event: 'connect.challenge';
  payload: Record<string, unknown>;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    instanceId: string;
  };
  role: string;
  scopes: string[];
  auth: {
    token: string;
  };
  caps: string[];
  userAgent: string;
  locale: string;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  identityName?: string;
  identityEmoji?: string;
  workspace?: string;
  model?: string;
  tools?: string[];
  sandbox?: Record<string, unknown>;
}

export interface AgentCreateParams {
  id?: string;
  name: string;
  workspace?: string;
}

export interface AgentCreateResponse {
  agentId: string;
}

export interface AgentUpdateParams {
  agentId: string;
  name: string;
}

export interface AgentDeleteParams {
  agentId: string;
}

export interface AgentListResponse {
  agents?: Agent[];
}

export interface AgentFilesSetParams {
  agentId: string;
  name: string;
  content: string;
}

// Session Types
export interface Session {
  key: string;
  sessionId: string;
  kind: string;
  abortedLastRun?: boolean;
  thinkingLevel?: number;
  verboseLevel?: number;
  reasoningLevel?: number;
  model?: string;
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface SessionPatchParams {
  key: string;
  thinkingLevel?: number;
  verboseLevel?: number;
  reasoningLevel?: number;
  model?: string;
}

// Chat Types
export interface ChatSendParams {
  sessionKey: string;
  message: string;
  deliver: boolean;
  idempotencyKey: string;
}

export interface ChatSendResponse {
  runId?: string;
}

// Models
export interface ModelsListResponse {
  models: Array<{
    name: string;
    provider: string;
  }>;
}

// Config
export interface ConfigGetResponse {
  path?: string;
  exists?: boolean;
  hash?: string;
  config?: Record<string, unknown>;
}

export interface ConfigPatchParams {
  raw: string;
  baseHash?: string;
}
