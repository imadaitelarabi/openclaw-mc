/**
 * Message Handler Router
 * Central dispatcher for WebSocket client messages
 */

import type { ClientMessage, ExtendedWebSocket } from "../types/internal";
import type { GatewayClient } from "../core/GatewayClient";
import { ConfigManager } from "../core/ConfigManager";
import { handleAgentAdd, handleAgentUpdate, handleAgentDelete } from "./agent.handler";
import { handleChatSend, handleChatHistoryLoad, handleChatAbort } from "./chat.handler";
import { handleSessionsList, handleSessionsPatch } from "./session.handler";
import {
  handleGatewaysList,
  handleGatewaysAdd,
  handleGatewaysSwitch,
  handleGatewaysRemove,
  handleGatewayCall,
} from "./gateway.handler";
import { handleModelsList } from "./models.handler";
import { handleSkillsList } from "./skills.handler";
import {
  handleCronList,
  handleCronStatus,
  handleCronAdd,
  handleCronUpdate,
  handleCronDelete,
  handleCronRuns,
  handleCronRun,
} from "./cron.handler";
import {
  handleNotesList,
  handleNotesGroupsList,
  handleNotesGroupsAdd,
  handleNotesGroupsDelete,
  handleNotesImageUpload,
  handleNotesAdd,
  handleNotesUpdate,
  handleNotesDelete,
  handleNotesTagColorSet,
  handleNotesTagDelete,
  handleNotesTagCreate,
} from "./notes.handler";

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
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;

      case "gateways.list":
        await handleGatewaysList(msg, ws, configManager);
        break;

      case "gateways.add":
        await handleGatewaysAdd(msg, ws, gateway, configManager);
        break;

      case "gateways.switch":
        await handleGatewaysSwitch(msg, ws, gateway);
        break;

      case "gateways.remove":
        await handleGatewaysRemove(msg, ws, gateway, configManager);
        break;

      case "gateway.call":
        await handleGatewayCall(msg, ws, gateway);
        break;

      case "chat.send":
        await handleChatSend(msg, ws, gateway);
        break;

      case "chat.history.load":
        await handleChatHistoryLoad(msg, ws, gateway);
        break;

      case "chat.abort.run":
        await handleChatAbort(msg, ws, gateway);
        break;

      case "models.list":
        await handleModelsList(msg, ws, gateway);
        break;

      case "skills.list":
        await handleSkillsList(msg, ws, gateway);
        break;

      case "sessions.list":
        await handleSessionsList(msg, ws, gateway, sessionPatches);
        break;

      case "sessions.patch":
        await handleSessionsPatch(msg, ws, gateway, sessionPatches);
        break;

      case "agents.add":
        await handleAgentAdd(msg, ws, gateway);
        break;

      case "agents.update":
        await handleAgentUpdate(msg, ws, gateway);
        break;

      case "agents.delete":
        await handleAgentDelete(msg, ws, gateway);
        break;

      case "cron.list":
        await handleCronList(msg, ws, gateway);
        break;

      case "cron.status":
        await handleCronStatus(msg, ws, gateway);
        break;

      case "cron.add":
        await handleCronAdd(msg, ws, gateway);
        break;

      case "cron.update":
        await handleCronUpdate(msg, ws, gateway);
        break;

      case "cron.delete":
        await handleCronDelete(msg, ws, gateway);
        break;

      case "cron.runs":
        await handleCronRuns(msg, ws, gateway);
        break;

      case "cron.run":
        await handleCronRun(msg, ws, gateway);
        break;

      case "notes.list":
        await handleNotesList(msg, ws);
        break;

      case "notes.groups.list":
        await handleNotesGroupsList(msg, ws);
        break;

      case "notes.groups.add":
        await handleNotesGroupsAdd(msg, ws);
        break;

      case "notes.groups.delete":
        await handleNotesGroupsDelete(msg, ws);
        break;

      case "notes.image.upload":
        await handleNotesImageUpload(msg, ws);
        break;

      case "notes.add":
        await handleNotesAdd(msg, ws);
        break;

      case "notes.update":
        await handleNotesUpdate(msg, ws);
        break;

      case "notes.delete":
        await handleNotesDelete(msg, ws);
        break;

      case "notes.tags.color.set":
        await handleNotesTagColorSet(msg, ws);
        break;

      case "notes.tags.delete":
        await handleNotesTagDelete(msg, ws);
        break;

      case "notes.tags.create":
        await handleNotesTagCreate(msg, ws);
        break;

      default:
        console.warn(`[Client] Unknown message type: ${(msg as any).type}`);
    }
  } catch (err) {
    console.error("[Client] Error handling message:", err);
    ws.send(
      JSON.stringify({
        type: "error",
        message: (err as Error).message || "Internal server error",
      })
    );
  }
}
