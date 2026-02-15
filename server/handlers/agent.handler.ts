/**
 * Agent Handler
 * Handles agent creation, update, and deletion operations
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';
import { dirnameLike, joinPathLike } from '../utils/paths';
import { slugifyAgentName } from '../utils/strings';

export async function handleAgentAdd(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const { requestId, id, name, workspace, model, tools, sandbox } = msg;

    // Validation
    if (!name) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Agent name is required',
        })
      );
      return;
    }

    console.log(`[Client] Creating agent: ${name} (id: ${id || 'auto-generated'})`);

    // Resolve workspace similarly to OpenClaw Studio when not explicitly provided
    let resolvedWorkspace = workspace || undefined;
    if (!resolvedWorkspace) {
      const configSnapshot = await gateway.request('config.get', {});
      const configPath =
        typeof configSnapshot?.path === 'string' ? configSnapshot.path.trim() : '';
      const stateDir = dirnameLike(configPath);
      const slug = slugifyAgentName(name);
      if (stateDir && slug) {
        resolvedWorkspace = joinPathLike(stateDir, `workspace-${slug}`);
      }
    }

    // Create agent. Some gateway versions reject custom id; retry without it.
    let createResult;
    if (id) {
      try {
        createResult = await gateway.request('agents.create', {
          id,
          name,
          workspace: resolvedWorkspace,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/\bid\b|unknown|invalid/i.test(message)) {
          console.warn('[Client] agents.create rejected custom id, retrying without id');
          createResult = await gateway.request('agents.create', {
            name,
            workspace: resolvedWorkspace,
          });
        } else {
          throw err;
        }
      }
    } else {
      createResult = await gateway.request('agents.create', {
        name,
        workspace: resolvedWorkspace,
      });
    }
    const agentId = createResult.agentId;
    if (!agentId) {
      throw new Error('Gateway returned an invalid agents.create response (missing agentId).');
    }

    console.log(`[Client] Agent created with ID: ${agentId}`);

    // Initialize workspace files atomically
    // Create default AGENTS.md
    await gateway.request('agents.files.set', {
      agentId,
      name: 'AGENTS.md',
      content: `# ${name}\n\nYou are ${name}, an AI assistant powered by OpenClaw.\n\n## Instructions\n\nProvide helpful, accurate, and thoughtful responses to user queries.\n`,
    });

    // Create default SOUL.md
    await gateway.request('agents.files.set', {
      agentId,
      name: 'SOUL.md',
      content: `# ${name}'s Persona\n\nI am ${name}, ready to assist with your tasks.\n`,
    });

    console.log(`[Client] Workspace files initialized for agent: ${agentId}`);

    // If there are config overrides (model, tools, sandbox), use config.patch
    if (model || tools || sandbox) {
      const configSnapshot = await gateway.request('config.get', {});
      const baseConfig =
        configSnapshot && typeof configSnapshot.config === 'object' && configSnapshot.config
          ? { ...configSnapshot.config }
          : {};

      const agents =
        baseConfig.agents && typeof baseConfig.agents === 'object' ? { ...baseConfig.agents } : {};
      const list = Array.isArray(agents.list) ? [...agents.list] : [];

      const index = list.findIndex(
        (entry: any) => entry && typeof entry === 'object' && entry.id === agentId
      );
      const current =
        index >= 0 && list[index] && typeof list[index] === 'object'
          ? { ...list[index] }
          : { id: agentId, name };

      if (model) current.model = model;
      if (tools) current.tools = tools;
      if (sandbox) current.sandbox = sandbox;

      if (index >= 0) {
        list[index] = current;
      } else {
        list.push(current);
      }

      const patch = { agents: { list } };
      const patchPayload: any = {
        raw: JSON.stringify(patch, null, 2),
      };
      if (configSnapshot?.exists !== false && configSnapshot?.hash) {
        patchPayload.baseHash = configSnapshot.hash;
      }

      await gateway.request('config.patch', patchPayload);

      console.log(`[Client] Applied configuration overrides for agent: ${agentId}`);
    }

    // Immediately refresh and broadcast updated agents/sessions
    await gateway.fetchInitialData();

    ws.send(
      JSON.stringify({
        type: 'agents.add.ack',
        requestId,
        agentId,
      })
    );
  } catch (err) {
    console.error('[Client] Agent creation failed:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : 'Failed to create agent',
      })
    );
  }
}

export async function handleAgentUpdate(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const { requestId, agentId, name } = msg;

    const trimmedAgentId = typeof agentId === 'string' ? agentId.trim() : '';
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedAgentId) {
      ws.send(
        JSON.stringify({
          type: 'error',
          requestId,
          message: 'agentId is required',
        })
      );
      return;
    }

    if (!trimmedName) {
      ws.send(
        JSON.stringify({
          type: 'error',
          requestId,
          message: 'Agent name is required',
        })
      );
      return;
    }

    await gateway.request('agents.update', {
      agentId: trimmedAgentId,
      name: trimmedName,
    });

    await gateway.fetchInitialData();

    ws.send(
      JSON.stringify({
        type: 'agents.update.ack',
        requestId,
        agentId: trimmedAgentId,
        name: trimmedName,
      })
    );
  } catch (err) {
    console.error('[Client] Agent update failed:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : 'Failed to update agent',
      })
    );
  }
}

export async function handleAgentDelete(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  try {
    const { requestId, agentId } = msg;
    const trimmedAgentId = typeof agentId === 'string' ? agentId.trim() : '';

    if (!trimmedAgentId) {
      ws.send(
        JSON.stringify({
          type: 'error',
          requestId,
          message: 'agentId is required',
        })
      );
      return;
    }

    let removed = true;
    try {
      await gateway.request('agents.delete', { agentId: trimmedAgentId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/not found/i.test(message)) {
        removed = false;
      } else {
        throw err;
      }
    }

    await gateway.fetchInitialData();

    ws.send(
      JSON.stringify({
        type: 'agents.delete.ack',
        requestId,
        agentId: trimmedAgentId,
        removed,
      })
    );
  } catch (err) {
    console.error('[Client] Agent delete failed:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        requestId: msg.requestId,
        message: err instanceof Error ? err.message : 'Failed to delete agent',
      })
    );
  }
}
