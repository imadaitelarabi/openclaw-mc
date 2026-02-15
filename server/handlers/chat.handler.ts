/**
 * Chat Handler
 * Handles chat message sending
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';

export async function handleChatSend(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  // Handle chat messages from client
  if (msg.agentId && msg.message) {
    await gateway.sendChat(msg.agentId, msg.message);
  }
}
