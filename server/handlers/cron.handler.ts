/**
 * Cron Handler
 * Handles cron job management operations via gateway RPC pass-through
 */

import type { ExtendedWebSocket } from '../types/internal';
import type { GatewayClient } from '../core/GatewayClient';

function unwrapPayload(value: any): any {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const looksLikeCronJob =
    'schedule' in value ||
    'sessionTarget' in value ||
    'delivery' in value ||
    'createdAtMs' in value ||
    'updatedAtMs' in value;

  const looksLikeCronRun =
    'sessionKey' in value ||
    'startedAtMs' in value ||
    ('jobId' in value && 'status' in value);

  const looksLikeCronStatus = 'enabled' in value && 'jobs' in value;
  const looksLikeCronListPayload = Array.isArray((value as any).jobs) || Array.isArray((value as any).entries);
  const looksLikeGatewayEnvelope = 'ok' in value || ('type' in value && 'id' in value && 'payload' in value);

  if (
    'payload' in value &&
    (looksLikeGatewayEnvelope || (!looksLikeCronJob && !looksLikeCronRun && !looksLikeCronStatus && !looksLikeCronListPayload))
  ) {
    return (value as any).payload;
  }

  return value;
}

function normalizeCronJob(value: any): any {
  const payload = unwrapPayload(value);
  if (payload && typeof payload === 'object' && payload.id) {
    return payload;
  }
  if (payload && typeof payload === 'object' && payload.job && payload.job.id) {
    return payload.job;
  }
  return null;
}

function normalizeCronRuns(value: any): any[] {
  const payload = unwrapPayload(value);
  if (payload && Array.isArray(payload.entries)) {
    return payload.entries;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}

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
    const payload = unwrapPayload(result);
    const jobs = Array.isArray(payload) ? payload : payload?.jobs || [];
    ws.send(
      JSON.stringify({
        type: 'cron.list.response',
        requestId,
        jobs
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
    const result = await gateway.call('cron.status', {});
    const payload = unwrapPayload(result);
    const status = payload?.status || payload;
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
    const createdJob = normalizeCronJob(result);

    if (!createdJob) {
      throw new Error('Gateway returned an invalid cron.add response');
    }

    ws.send(
      JSON.stringify({
        type: 'cron.add.response',
        requestId,
        job: createdJob
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
    const updatedJob = normalizeCronJob(result);

    if (!updatedJob) {
      throw new Error('Gateway returned an invalid cron.update response');
    }

    ws.send(
      JSON.stringify({
        type: 'cron.update.response',
        requestId,
        job: updatedJob
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
    const entries = normalizeCronRuns(result);
    ws.send(
      JSON.stringify({
        type: 'cron.runs.response',
        requestId,
        entries
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
    const run = unwrapPayload(result)?.run || unwrapPayload(result);
    if (!run || typeof run !== 'object' || !run.id) {
      throw new Error('Gateway returned an invalid cron.run response');
    }

    ws.send(
      JSON.stringify({
        type: 'cron.run.response',
        requestId,
        run
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
