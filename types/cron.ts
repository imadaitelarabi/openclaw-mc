/**
 * Cron Job Types
 * Type definitions for cron job management
 */

export interface Schedule {
  kind: 'cron' | 'interval' | 'oneshot';
  expr?: string;  // Cron expression (e.g., "0 8 * * *")
  intervalMs?: number;  // For interval schedules
  tz?: string;  // Timezone (e.g., "UTC", "America/New_York")
}

export interface CronPayload {
  kind: 'agentTurn';
  message: string;
  agentId?: string;
}

export interface CronDelivery {
  mode: 'announce' | 'silent';
  channel?: 'last' | 'new' | string;  // Session routing
}

export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  runCount?: number;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: Schedule;
  sessionTarget: 'isolated' | 'shared' | 'last'; // 'last' kept for backward compatibility with persisted legacy jobs
  wakeMode?: 'now' | 'schedule';
  payload: CronPayload;
  delivery: CronDelivery;
  state?: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number;
  storePath?: string;
}

export interface CronRun {
  id: string;
  jobId: string;
  status: 'ok' | 'error' | 'running';
  startedAtMs: number;
  finishedAtMs?: number;
  sessionKey: string;
  output?: string;
  error?: string;
}

export interface CronRunsResponse {
  entries: CronRun[];
}

export interface CronEvent {
  type: 'job_added' | 'job_updated' | 'job_deleted' | 'job_started' | 'job_finished' | 'status_changed';
  action?: 'added' | 'updated' | 'deleted' | 'started' | 'finished' | 'status_changed';
  job?: CronJob;
  jobId?: string;
  status?: CronStatus;
  run?: CronRun;
}
