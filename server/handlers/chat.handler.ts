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
      const fetched = await gateway.fetchChatHistory(params.sessionKey, Math.max(limit, maxFetch));
      if (Array.isArray(fetched) && fetched.length > 0) {
        const idx = fetched.findIndex((m: any) => {
          if (!m) return false;
          if (m.id && m.id === params.before) return true;
          if (m.runId && m.runId === params.before) return true;
          if (m.timestamp && String(m.timestamp) === String(params.before)) return true;
          return false;
        });
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
