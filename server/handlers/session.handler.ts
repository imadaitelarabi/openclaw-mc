/**
 * Session Handler
 * Handles session operations (list, patch)
 */

import type { ExtendedWebSocket } from "../types/internal";
import type { GatewayClient } from "../core/GatewayClient";

export async function handleSessionsList(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient,
  sessionPatches: Map<string, any>
): Promise<void> {
  try {
    const sessions = await gateway.request("sessions.list", {});
    // Merge patches
    if (sessions.sessions) {
      sessions.sessions.forEach((s: any) => {
        const patch = sessionPatches.get(s.key);
        if (patch) Object.assign(s, patch);
      });
    }
    ws.send(JSON.stringify({ type: "sessions", data: sessions }));
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: (err as Error).message,
      })
    );
  }
}

export async function handleSessionsPatch(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient,
  sessionPatches: Map<string, any>
): Promise<void> {
  try {
    const { sessionKey, type, thinking, verbose, reasoning, model, modelProvider, ...rest } = msg;

    // Map frontend names to gateway schema names
    const patch: any = { ...rest };
    if (thinking !== undefined) patch.thinkingLevel = thinking;
    if (verbose !== undefined) patch.verboseLevel = verbose;
    if (reasoning !== undefined) patch.reasoningLevel = reasoning;

    // Gateway expects model as "provider/model" string or alias
    if (model !== undefined) {
      if (modelProvider) {
        patch.model = `${modelProvider}/${model}`;
      } else {
        patch.model = model;
      }
    }

    console.log(`[Client] Patching session ${sessionKey}:`, patch);

    // Track in server-side map for polling consistency
    sessionPatches.set(sessionKey, { ...(sessionPatches.get(sessionKey) || {}), ...patch });

    // Forward to Gateway
    const gatewayRes = await gateway.request("sessions.patch", { key: sessionKey, ...patch });
    console.log(`[Gateway] Patch response:`, gatewayRes);

    ws.send(JSON.stringify({ type: "sessions.patch.ack" }));

    // Broadcast updated sessions to all clients immediately
    const sessions = await gateway.request("sessions.list", {});
    // Merge patches
    if (sessions.sessions) {
      sessions.sessions.forEach((s: any) => {
        const p = sessionPatches.get(s.key);
        if (p) Object.assign(s, p);
      });
    }
    gateway.broadcast({ type: "sessions", data: sessions });
  } catch (err) {
    console.error("[Client] Patch failed:", err);
    ws.send(
      JSON.stringify({
        type: "error",
        message: (err as Error).message,
      })
    );
  }
}
