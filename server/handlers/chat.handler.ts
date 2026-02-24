/**
 * Chat Handler
 * Handles chat message sending and history loading
 */

import type { ExtendedWebSocket } from "../types/internal";
import type { GatewayClient } from "../core/GatewayClient";

interface ChatHistoryLoadMessage {
  type: "chat.history.load";
  agentId: string;
  params: {
    sessionKey: string;
    limit?: number;
    before?: string;
  };
}

function normalizeTextContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTextContent(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    if (record.content !== undefined) return normalizeTextContent(record.content);
    if (typeof record.value === "string") return record.value;

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function computeStableHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function buildFallbackHistoryId(msg: any): string {
  const role = typeof msg?.role === "string" ? msg.role : "unknown";
  const timestamp = typeof msg?.timestamp === "number" ? msg.timestamp : 0;
  const runId = typeof msg?.runId === "string" ? msg.runId : "";
  const toolCallId = normalizeTextContent(msg?.toolCallId || "");
  const toolName = normalizeTextContent(msg?.toolName || msg?.tool?.name || "");
  const content = normalizeTextContent(msg?.content ?? msg?.text ?? "").slice(0, 500);
  const signature = `${role}|${timestamp}|${runId}|${toolCallId}|${toolName}|${content}`;
  return `hist-${computeStableHash(signature)}`;
}

function toContentParts(content: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(content)) {
    return content.filter(
      (part): part is Record<string, unknown> => typeof part === "object" && part !== null
    );
  }

  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  if (content && typeof content === "object") {
    return [content as Record<string, unknown>];
  }

  return [];
}

function collectGatewayMessageAnchorIds(msg: any): Set<string> {
  const ids = new Set<string>();

  const timestamp = typeof msg?.timestamp === "number" ? String(msg.timestamp) : "";
  if (timestamp) ids.add(timestamp);

  const baseId = normalizeTextContent(msg?.id || msg?.runId || buildFallbackHistoryId(msg));
  if (baseId) {
    ids.add(baseId);
    ids.add(`${baseId}-reasoning`);
  }

  const runId = normalizeTextContent(msg?.runId);
  if (runId) ids.add(runId);

  const toolCallId = normalizeTextContent(msg?.toolCallId);
  if (toolCallId) ids.add(toolCallId);

  const parts = toContentParts(msg?.content);
  parts.forEach((part, partIndex) => {
    const partType = normalizeTextContent(part.type || "");
    if (partType === "toolCall") {
      const partId = normalizeTextContent(part.id || `${baseId}-tool-${partIndex}`);
      if (partId) ids.add(partId);
    }
  });

  return ids;
}

function findBeforeAnchorIndex(messages: any[], before: string): number {
  for (let index = 0; index < messages.length; index += 1) {
    const messageIds = collectGatewayMessageAnchorIds(messages[index]);
    if (messageIds.has(before)) {
      return index;
    }
  }
  return -1;
}

export async function handleChatSend(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  // Handle chat messages from client
  if (msg.agentId && msg.message) {
    await gateway.sendChat(msg.agentId, msg.message, msg.attachments);
  }
}

export async function handleChatHistoryLoad(
  msg: ChatHistoryLoadMessage,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const { agentId, params } = msg;
    if (!agentId || !params?.sessionKey) {
      console.error("[Chat] Invalid chat.history.load request");
      return;
    }

    // Fetch history from Gateway
    const limit = params.limit || 50;
    let messages: any[] = [];

    if (params.before) {
      // Gateway `chat.history` does not support pagination via a `before` cursor.
      // Workaround: fetch a larger window (up to gateway hard max) and slice locally
      // to return messages older than the `before` anchor.
      const maxFetch = 1000; // gateway hard max
      const fetched = await gateway.fetchChatHistory(params.sessionKey, maxFetch);
      if (Array.isArray(fetched) && fetched.length > 0) {
        const idx = findBeforeAnchorIndex(fetched, params.before);
        if (idx >= 0) {
          const start = Math.max(0, idx - limit);
          messages = fetched.slice(start, idx);
        } else {
          // Anchor not found in fetched window — return empty to indicate no older messages in window
          messages = [];
        }
      }
    } else {
      messages = await gateway.fetchChatHistory(params.sessionKey, limit);
    }

    // Send response back to client
    ws.send(
      JSON.stringify({
        type: "chat_history_more",
        agentId,
        sessionKey: params.sessionKey,
        messages,
        before: params.before,
      })
    );
  } catch (err) {
    console.error("[Chat] Failed to load history:", err);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to load chat history",
      })
    );
  }
}

export async function handleChatAbort(
  msg: { agentId: string },
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  if (msg.agentId) {
    const result = await gateway.abortChat(msg.agentId);
    ws.send(
      JSON.stringify({
        type: "chat.abort.run.ack",
        agentId: msg.agentId,
        ok: result.ok,
        error: result.error,
      })
    );
  }
}
