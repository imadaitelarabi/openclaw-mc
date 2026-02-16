/**
 * Gateway Handler
 * Handles gateway management operations (list, add, switch, remove)
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';
import { ConfigManager } from '../core/ConfigManager';

export async function handleGatewaysList(
  msg: any,
  ws: ExtendedWebSocket,
  configManager: ConfigManager
): Promise<void> {
  ws.send(
    JSON.stringify({
      type: 'gateways.list',
      data: configManager.getGateways(),
      activeId: configManager.getActiveGatewayId(),
    })
  );
}

export async function handleGatewaysAdd(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient,
  configManager: ConfigManager
): Promise<void> {
  const { name, url, token } = msg;
  configManager.addGateway(name, url, token);
  gateway.updateFromConfig();
  gateway.connect();
  try {
    await gateway.waitForAuthenticated(15000);
    ws.send(JSON.stringify({ type: 'gateways.add.ack' }));
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: (err as Error).message || 'Failed to connect to gateway',
      })
    );
  }
}

export async function handleGatewaysSwitch(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  gateway.switch(msg.id);
  ws.send(JSON.stringify({ type: 'gateways.switch.ack' }));
}

export async function handleGatewaysRemove(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient,
  configManager: ConfigManager
): Promise<void> {
  configManager.removeGateway(msg.id);
  gateway.updateFromConfig();
  gateway.connect();
  ws.send(JSON.stringify({ type: 'gateways.remove.ack' }));
}

/**
 * Generic gateway RPC call pass-through
 * Allows UI to call any Gateway method without specific server handlers
 */
export async function handleGatewayCall(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { method, params, requestId } = msg;
  
  if (!method) {
    ws.send(
      JSON.stringify({
        type: 'gateway.call.error',
        requestId,
        error: 'Missing method parameter',
      })
    );
    return;
  }

  try {
    const result = await gateway.call(method, params || {});
    ws.send(
      JSON.stringify({
        type: 'gateway.call.response',
        requestId,
        result,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'gateway.call.error',
        requestId,
        error: (err as Error).message || 'Gateway call failed',
      })
    );
  }
}
