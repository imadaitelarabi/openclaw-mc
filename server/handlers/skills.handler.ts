/**
 * Skills Handler
 * Fetches skills status from the Gateway
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';

export async function handleSkillsList(
  msg: { requestId?: string; agentId?: string },
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const params = msg.agentId ? { agentId: msg.agentId } : {};
    const report = await gateway.request('skills.status', params);
    ws.send(
      JSON.stringify({
        type: 'skills.list.response',
        requestId: msg.requestId,
        report,
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'skills.list.error',
        requestId: msg.requestId,
        error: (err as Error).message,
      })
    );
  }
}
