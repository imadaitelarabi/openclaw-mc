/**
 * Cron Runs Hook
 * Manages cron run history for a specific job
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CronRun } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface UseCronRunsProps {
  jobId: string;
  wsRef: React.RefObject<WebSocket | null>;
  limit?: number;
}

export function useCronRuns({ jobId, wsRef, limit = 10 }: UseCronRunsProps) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>>(new Map());

  // Load run history
  useEffect(() => {
    if (!jobId) return;
    loadRuns();
  }, [jobId, limit]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle cron runs responses
        if (msg.type === 'cron.runs.response') {
          setRuns(msg.entries || []);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.entries);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'cron.runs.error') {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron run trigger responses
        if (msg.type === 'cron.run.response') {
          // Add the new run to the list
          setRuns(prev => [msg.run, ...prev]);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.run);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'cron.run.error') {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron events for job runs
        if (msg.type === 'event' && msg.event === 'cron') {
          const cronEvent = msg.payload;
          
          if (cronEvent.type === 'job_started' && cronEvent.run?.jobId === jobId) {
            setRuns(prev => [cronEvent.run, ...prev]);
          } else if (cronEvent.type === 'job_finished' && cronEvent.run?.jobId === jobId) {
            setRuns(prev => prev.map(r => r.id === cronEvent.run.id ? cronEvent.run : r));
          }
        }
      } catch (err) {
        console.error('[useCronRuns] Failed to parse message:', err);
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef, jobId]);

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

  const loadRuns = useCallback(async () => {
    if (!jobId) return;
    
    try {
      setLoading(true);
      await sendRequest('cron.runs', { jobId, limit });
    } catch (err) {
      console.error('[useCronRuns] Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  }, [sendRequest, jobId, limit]);

  const triggerRun = useCallback(async (mode: 'force' | 'schedule' = 'force'): Promise<CronRun> => {
    return sendRequest('cron.run', { jobId, mode });
  }, [sendRequest, jobId]);

  return {
    runs,
    loading,
    triggerRun,
    refreshRuns: loadRuns,
  };
}
