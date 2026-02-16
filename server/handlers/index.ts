/**
 * Message Handler Router
 * Central dispatcher for WebSocket client messages
 */

import type { ClientMessage, ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';
import { ConfigManager } from '../core/ConfigManager';
import { handleAgentAdd, handleAgentUpdate, handleAgentDelete } from './agent.handler';
import { handleChatSend, handleChatHistoryLoad, handleChatAbort } from './chat.handler';
import { handleSessionsList, handleSessionsPatch } from './session.handler';
import {
  handleGatewaysList,
  handleGatewaysAdd,
  handleGatewaysSwitch,
  handleGatewaysRemove,
  handleGatewayCall,
} from './gateway.handler';
import { handleModelsList } from './models.handler';

// Singleton config manager (shared with GatewayClient)
const configManager = new ConfigManager();

export { configManager };

export async function handleMessage(
  msg: ClientMessage,
  ws: ExtendedWebSocket,
  gateway: GatewayClient,
  sessionPatches: Map<string, any>
): Promise<void> {
  try {
    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'gateways.list':
        await handleGatewaysList(msg, ws, configManager);
        break;

      case 'gateways.add':
        await handleGatewaysAdd(msg, ws, gateway, configManager);
        break;

      case 'gateways.switch':
        await handleGatewaysSwitch(msg, ws, gateway);
        break;

      case 'gateways.remove':
        await handleGatewaysRemove(msg, ws, gateway, configManager);
        break;

      case 'gateway.call':
        await handleGatewayCall(msg, ws, gateway);
        break;

      case 'chat.send':
        await handleChatSend(msg, ws, gateway);
        break;

      case 'chat.history.load':
        await handleChatHistoryLoad(msg, ws, gateway);
        break;

      case 'chat.abort.run':
        await handleChatAbort(msg, ws, gateway);
        break;

      case 'models.list':
        await handleModelsList(msg, ws, gateway);
        break;

      case 'sessions.list':
        await handleSessionsList(msg, ws, gateway, sessionPatches);
        break;

      case 'sessions.patch':
        await handleSessionsPatch(msg, ws, gateway, sessionPatches);
        break;

      case 'agents.add':
        await handleAgentAdd(msg, ws, gateway);
        break;

      case 'agents.update':
        await handleAgentUpdate(msg, ws, gateway);
        break;

      case 'agents.delete':
        await handleAgentDelete(msg, ws, gateway);
        break;

      default:
        console.warn(`[Client] Unknown message type: ${(msg as any).type}`);
    }
  } catch (err) {
    console.error('[Client] Error handling message:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        message: (err as Error).message || 'Internal server error',
      })
    );
  }
}
