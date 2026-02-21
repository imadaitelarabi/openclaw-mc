/**
 * Internal Server Type Definitions
 * Types for internal server state and client communication
 */

import type { Agent, Session, ModelsListResponse } from "./gateway";
import type WebSocket from "ws";

// Note type for notes feature
export interface Note {
  id: string;
  content: string;
  group: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  imageUrl?: string;
}

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
  | { type: "ping" }
  | { type: "gateways.list" }
  | { type: "gateways.add"; requestId?: string; name: string; url: string; token: string }
  | { type: "gateways.switch"; id: string }
  | { type: "gateways.remove"; id: string }
  | { type: "gateway.call"; method: string; params?: Record<string, unknown>; requestId?: string }
  | { type: "chat.send"; agentId: string; message: string }
  | {
      type: "chat.history.load";
      agentId: string;
      params: {
        sessionKey: string;
        limit?: number;
        before?: string;
      };
    }
  | { type: "chat.abort.run"; agentId: string }
  | { type: "models.list" }
  | { type: "skills.list"; requestId?: string; agentId?: string }
  | { type: "sessions.list" }
  | {
      type: "sessions.patch";
      sessionKey: string;
      thinking?: number;
      verbose?: number;
      reasoning?: number;
      model?: string;
      modelProvider?: string;
    }
  | {
      type: "agents.add";
      requestId?: string;
      id?: string;
      name: string;
      workspace?: string;
      model?: string;
      tools?: string[];
      sandbox?: Record<string, unknown>;
    }
  | {
      type: "agents.update";
      requestId?: string;
      agentId: string;
      name: string;
    }
  | {
      type: "agents.delete";
      requestId?: string;
      agentId: string;
    }
  | { type: "cron.list"; requestId?: string }
  | { type: "cron.status"; requestId?: string }
  | { type: "cron.add"; requestId?: string; job: any }
  | { type: "cron.update"; requestId?: string; jobId: string; updates: any }
  | { type: "cron.delete"; requestId?: string; jobId: string }
  | { type: "cron.runs"; requestId?: string; jobId: string; limit?: number }
  | { type: "cron.run"; requestId?: string; jobId: string; mode?: string }
  | { type: "notes.list"; requestId?: string }
  | { type: "notes.groups.list"; requestId?: string }
  | { type: "notes.groups.add"; requestId?: string; group: string }
  | { type: "notes.groups.delete"; requestId?: string; group: string }
  | {
      type: "notes.image.upload";
      requestId?: string;
      media: string;
      mimeType?: string;
      fileName?: string;
    }
  | {
      type: "notes.add";
      requestId?: string;
      content: string;
      group: string;
      tags?: string[];
      imageUrl?: string;
    }
  | {
      type: "notes.update";
      requestId?: string;
      id: string;
      content?: string;
      group?: string;
      tags?: string[];
      imageUrl?: string;
    }
  | { type: "notes.tags.color.set"; requestId?: string; tag: string; color: string }
  | { type: "notes.tags.delete"; requestId?: string; tag: string }
  | { type: "notes.tags.create"; requestId?: string; tag: string }
  | { type: "notes.delete"; requestId?: string; id: string };

// Server to Client Messages
export type ServerMessage =
  | { type: "pong" }
  | { type: "status"; status: string; gatewayId?: string }
  | { type: "gateways.list"; data: GatewayConfig[]; activeId: string | null }
  | { type: "gateways.add.ack"; requestId?: string }
  | { type: "gateways.switch.ack" }
  | { type: "gateways.remove.ack" }
  | { type: "gateway.call.response"; requestId?: string; result: unknown }
  | { type: "gateway.call.error"; requestId?: string; error: string }
  | { type: "error"; message: string; requestId?: string }
  | { type: "agents"; data: TransformedAgent[] }
  | { type: "agent_definitions"; data: Agent[] }
  | { type: "sessions"; data: { sessions: Session[] } }
  | { type: "sessions.patch.ack" }
  | { type: "models"; data: ModelsListResponse }
  | { type: "skills.list.response"; requestId?: string; report: unknown }
  | { type: "skills.list.error"; requestId?: string; error: string }
  | { type: "agents.add.ack"; requestId?: string; agentId: string }
  | { type: "agents.update.ack"; requestId?: string; agentId: string; name: string }
  | { type: "agents.delete.ack"; requestId?: string; agentId: string; removed: boolean }
  | { type: "chat.abort.run.ack"; agentId: string; ok: boolean; error?: string }
  | { type: "chat_history"; agentId: string; messages: unknown[] }
  | {
      type: "chat_history_more";
      agentId: string;
      sessionKey?: string;
      messages: unknown[];
      before?: string;
    }
  | {
      type: "notes.list.response";
      requestId?: string;
      notes: Note[];
      groups: string[];
      allTags: string[];
      tagColors: Record<string, string>;
    }
  | { type: "notes.groups.list.response"; requestId?: string; groups: string[] }
  | { type: "notes.groups.add.ack"; requestId?: string; groups: string[]; group: string }
  | {
      type: "notes.groups.delete.ack";
      requestId?: string;
      groups: string[];
      notes: Note[];
      group: string;
    }
  | { type: "notes.image.upload.ack"; requestId?: string; imageUrl: string }
  | { type: "notes.add.ack"; requestId?: string; note: Note; tagColors: Record<string, string> }
  | { type: "notes.update.ack"; requestId?: string; note: Note; tagColors: Record<string, string> }
  | {
      type: "notes.tags.color.set.ack";
      requestId?: string;
      tag: string;
      color: string;
      tagColors: Record<string, string>;
    }
  | {
      type: "notes.tags.delete.ack";
      requestId?: string;
      tag: string;
      notes: Note[];
      allTags: string[];
      tagColors: Record<string, string>;
    }
  | {
      type: "notes.tags.create.ack";
      requestId?: string;
      tag: string;
      allTags: string[];
      tagColors: Record<string, string>;
    }
  | { type: "notes.delete.ack"; requestId?: string; id: string }
  | { type: "notes.list.error"; requestId?: string; error: string }
  | { type: "notes.groups.list.error"; requestId?: string; error: string }
  | { type: "notes.groups.add.error"; requestId?: string; error: string }
  | { type: "notes.groups.delete.error"; requestId?: string; error: string }
  | { type: "notes.image.upload.error"; requestId?: string; error: string }
  | { type: "notes.add.error"; requestId?: string; error: string }
  | { type: "notes.update.error"; requestId?: string; error: string }
  | { type: "notes.tags.color.set.error"; requestId?: string; error: string }
  | { type: "notes.tags.delete.error"; requestId?: string; error: string }
  | { type: "notes.tags.create.error"; requestId?: string; error: string }
  | { type: "notes.delete.error"; requestId?: string; error: string }
  | { type: "event"; event: string; payload: Record<string, unknown> };

// Transformed types for client display
export interface TransformedAgent {
  id: string;
  name: string;
  identity?: string;
  emoji?: string;
  status: "active" | "idle";
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
