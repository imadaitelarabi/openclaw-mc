import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SkillStatusReport } from '@/types';

interface UseSkillsProps {
  wsRef: React.RefObject<WebSocket | null>;
  connectionStatus?: string;
  autoLoad?: boolean;
}

export function useSkills({ wsRef, connectionStatus, autoLoad = true }: UseSkillsProps) {
  const [report, setReport] = useState<SkillStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequestsRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>>(
    new Map()
  );

  const socket = wsRef.current;

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'skills.list.response') {
          setReport(msg.report ?? null);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.report);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === 'skills.list.error') {
          setError(msg.error ?? 'Failed to load skills');
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }
      } catch (err) {
        console.error('[useSkills] Failed to parse message:', err);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);

  const sendRequest = useCallback((agentId?: string): Promise<SkillStatusReport> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const requestId = uuidv4();
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      wsRef.current.send(
        JSON.stringify({
          type: 'skills.list',
          requestId,
          ...(agentId ? { agentId } : {}),
        })
      );

      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }, [wsRef]);

  const refresh = useCallback(async (agentId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const next = await sendRequest(agentId);
      setReport(next ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  useEffect(() => {
    if (!autoLoad) return;
    if (connectionStatus !== 'connected') return;
    refresh();
  }, [autoLoad, connectionStatus, refresh]);

  return {
    report,
    loading,
    error,
    refresh,
  };
}
