/**
 * Cron Handler
 * Handles cron job management operations via gateway RPC pass-through
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';

/**
 * List all cron jobs
 */
export async function handleCronList(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId } = msg;
  
  try {
    const result = await gateway.call('cron.list', {});
    ws.send(
      JSON.stringify({
        type: 'cron.list.response',
        requestId,
        jobs: result.jobs || []
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.list.error',
        requestId,
        error: (err as Error).message || 'Failed to list cron jobs'
      })
    );
  }
}

/**
 * Get cron scheduler status
 */
export async function handleCronStatus(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId } = msg;
  
  try {
    const status = await gateway.call('cron.status', {});
    ws.send(
      JSON.stringify({
        type: 'cron.status.response',
        requestId,
        status
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.status.error',
        requestId,
        error: (err as Error).message || 'Failed to get cron status'
      })
    );
  }
}

/**
 * Add a new cron job
 */
export async function handleCronAdd(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId, job } = msg;
  
  if (!job) {
    ws.send(
      JSON.stringify({
        type: 'cron.add.error',
        requestId,
        error: 'Missing job parameter'
      })
    );
    return;
  }

  try {
    const result = await gateway.call('cron.add', job);
    ws.send(
      JSON.stringify({
        type: 'cron.add.response',
        requestId,
        job: result.job
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.add.error',
        requestId,
        error: (err as Error).message || 'Failed to add cron job'
      })
    );
  }
}

/**
 * Update an existing cron job
 */
export async function handleCronUpdate(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId, jobId, updates } = msg;
  
  if (!jobId || !updates) {
    ws.send(
      JSON.stringify({
        type: 'cron.update.error',
        requestId,
        error: 'Missing jobId or updates parameter'
      })
    );
    return;
  }

  try {
    const result = await gateway.call('cron.update', { jobId, patch: updates });
    ws.send(
      JSON.stringify({
        type: 'cron.update.response',
        requestId,
        job: result.job
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.update.error',
        requestId,
        error: (err as Error).message || 'Failed to update cron job'
      })
    );
  }
}

/**
 * Delete a cron job
 */
export async function handleCronDelete(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId, jobId } = msg;
  
  if (!jobId) {
    ws.send(
      JSON.stringify({
        type: 'cron.delete.error',
        requestId,
        error: 'Missing jobId parameter'
      })
    );
    return;
  }

  try {
    await gateway.call('cron.remove', { jobId });
    ws.send(
      JSON.stringify({
        type: 'cron.delete.response',
        requestId,
        jobId
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.delete.error',
        requestId,
        error: (err as Error).message || 'Failed to delete cron job'
      })
    );
  }
}

/**
 * Get run history for a cron job
 */
export async function handleCronRuns(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId, jobId, limit } = msg;
  
  if (!jobId) {
    ws.send(
      JSON.stringify({
        type: 'cron.runs.error',
        requestId,
        error: 'Missing jobId parameter'
      })
    );
    return;
  }

  try {
    const result = await gateway.call('cron.runs', { jobId, limit: limit || 10 });
    ws.send(
      JSON.stringify({
        type: 'cron.runs.response',
        requestId,
        entries: result.entries || []
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.runs.error',
        requestId,
        error: (err as Error).message || 'Failed to get cron runs'
      })
    );
  }
}

/**
 * Trigger a cron job run
 */
export async function handleCronRun(
  msg: any,
  ws: ExtendedWebSocket,
  gateway: GatewayClient
): Promise<void> {
  const { requestId, jobId, mode } = msg;
  
  if (!jobId) {
    ws.send(
      JSON.stringify({
        type: 'cron.run.error',
        requestId,
        error: 'Missing jobId parameter'
      })
    );
    return;
  }

  try {
    const result = await gateway.call('cron.run', { jobId, mode: mode || 'force' });
    ws.send(
      JSON.stringify({
        type: 'cron.run.response',
        requestId,
        run: result.run
      })
    );
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: 'cron.run.error',
        requestId,
        error: (err as Error).message || 'Failed to trigger cron run'
      })
    );
  }
}
