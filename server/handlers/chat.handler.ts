/**
 * Chat Handler
 * Handles chat message sending and history loading
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';

interface ChatHistoryLoadMessage {
  type: 'chat.history.load';
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
      console.error('[Chat] Invalid chat.history.load request');
      return;
    }

    // Fetch history from Gateway
    const messages = await gateway.fetchChatHistory(
      params.sessionKey,
      params.limit || 50,
      params.before
    );

    // Send response back to client
    ws.send(
      JSON.stringify({
        type: 'chat_history_more',
        agentId,
        messages,
        before: params.before,
      })
    );
  } catch (err) {
    console.error('[Chat] Failed to load history:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'Failed to load chat history',
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
    await gateway.abortChat(msg.agentId);
  }
}
