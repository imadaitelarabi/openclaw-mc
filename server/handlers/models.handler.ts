/**
 * Models Handler
 * Handles model listing operations
 */

import type { ExtendedWebSocket } from "../types/internal";
import type { GatewayClient } from "../core/GatewayClient";

export async function handleModelsList(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const models = await gateway.request("models.list", {});
    console.log(`[Gateway] Sending models list: ${(models.models || []).length} models`);
    ws.send(JSON.stringify({ type: "models", data: models }));
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: (err as Error).message,
      })
    );
  }
}
