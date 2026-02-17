/**
 * Cron Jobs Hook
 * Manages cron jobs state and provides operations for job management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CronJob, CronStatus, CronEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface UseCronJobsProps {
  wsRef: React.RefObject<WebSocket | null>;
  onEvent?: (event: CronEvent) => void;
}

export function useCronJobs({ wsRef, onEvent }: UseCronJobsProps) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>>(new Map());

  // Load initial data
  useEffect(() => {
    loadJobs();
    loadStatus();
  }, []);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle cron list responses
        if (msg.type === 'cron.list.response') {
          setJobs(msg.jobs || []);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.jobs);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'cron.list.error') {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron status responses
        if (msg.type === 'cron.status.response') {
          setStatus(msg.status);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.status);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle add/update/delete responses
        if (msg.type === 'cron.add.response') {
          setJobs(prev => [...prev, msg.job]);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.job);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'cron.update.response') {
          setJobs(prev => prev.map(j => j.id === msg.job.id ? msg.job : j));
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.job);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'cron.delete.response') {
          setJobs(prev => prev.filter(j => j.id !== msg.jobId));
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(true);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle error responses
        if (msg.type?.endsWith('.error') && msg.requestId) {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron events from gateway
        if (msg.type === 'event' && msg.event === 'cron') {
          const cronEvent = msg.payload as CronEvent;
          
          if (cronEvent.type === 'job_added' && cronEvent.job) {
            setJobs(prev => [...prev, cronEvent.job!]);
          } else if (cronEvent.type === 'job_updated' && cronEvent.job) {
            setJobs(prev => prev.map(j => j.id === cronEvent.job!.id ? cronEvent.job! : j));
          } else if (cronEvent.type === 'job_deleted' && cronEvent.jobId) {
            setJobs(prev => prev.filter(j => j.id !== cronEvent.jobId));
          } else if (cronEvent.type === 'status_changed' && cronEvent.status) {
            setStatus(cronEvent.status);
          }

          // Call custom event handler if provided
          if (onEvent) {
            onEvent(cronEvent);
          }
        }
      } catch (err) {
        console.error('[useCronJobs] Failed to parse message:', err);
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef, onEvent]);

  const sendRequest = useCallback((type: string, data: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = uuidv4();
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      wsRef.current.send(JSON.stringify({
        type,
        requestId,
        ...data
      }));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, [wsRef]);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      await sendRequest('cron.list');
    } catch (err) {
      console.error('[useCronJobs] Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  const loadStatus = useCallback(async () => {
    try {
      await sendRequest('cron.status');
    } catch (err) {
      console.error('[useCronJobs] Failed to load status:', err);
    }
  }, [sendRequest]);

  const addJob = useCallback(async (job: Omit<CronJob, 'id' | 'createdAtMs' | 'updatedAtMs'>): Promise<CronJob> => {
    return sendRequest('cron.add', { job });
  }, [sendRequest]);

  const updateJob = useCallback(async (jobId: string, updates: Partial<CronJob>): Promise<CronJob> => {
    return sendRequest('cron.update', { jobId, updates });
  }, [sendRequest]);

  const deleteJob = useCallback(async (jobId: string): Promise<boolean> => {
    return sendRequest('cron.delete', { jobId });
  }, [sendRequest]);

  const refreshJobs = useCallback(() => {
    loadJobs();
    loadStatus();
  }, [loadJobs, loadStatus]);

  return {
    jobs,
    status,
    loading,
    addJob,
    updateJob,
    deleteJob,
    refreshJobs,
  };
}
