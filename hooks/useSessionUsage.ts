import { useEffect, useState, useCallback, useRef } from 'react';

const REQUEST_TIMEOUT_MS = 30000;

export interface SessionUsage {
  totalTokens: number | null;
  modelContextWindow: number | null;
  isUnlimited: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseSessionUsageProps {
  wsRef: React.RefObject<WebSocket | null> | null | undefined;
  agentId: string;
  activeRunId: string | null;
}

export function useSessionUsage({ wsRef, agentId, activeRunId }: UseSessionUsageProps): SessionUsage {
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [modelContextWindow, setModelContextWindow] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousRunIdRef = useRef<string | null>(null);
  const pendingStatusRef = useRef<{ requestId: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const sessionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(() => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Cancel previous pending status request
    if (pendingStatusRef.current) {
      clearTimeout(pendingStatusRef.current.timeoutId);
    }

    const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timeoutId = setTimeout(() => {
      pendingStatusRef.current = null;
      // Status timeout is non-fatal — don't surface error if sessions data loaded
    }, REQUEST_TIMEOUT_MS);

    pendingStatusRef.current = { requestId, timeoutId };
    ws.send(JSON.stringify({ type: 'gateway.call', method: 'status', params: {}, requestId }));
  }, [wsRef]);

  const fetchUsage = useCallback(() => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Set a timeout to surface an error if sessions.list never responds
    if (sessionsTimeoutRef.current) clearTimeout(sessionsTimeoutRef.current);
    sessionsTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setError('Usage unavailable');
    }, REQUEST_TIMEOUT_MS);

    ws.send(JSON.stringify({ type: 'sessions.list' }));
    fetchStatus();
  }, [wsRef, fetchStatus]);

  // Fetch on mount and when agentId changes
  useEffect(() => {
    fetchUsage();
  }, [agentId, fetchUsage]);

  // Fetch when a run completes (activeRunId transitions from non-null to null)
  useEffect(() => {
    if (previousRunIdRef.current !== null && activeRunId === null) {
      fetchUsage();
    }
    previousRunIdRef.current = activeRunId;
  }, [activeRunId, fetchUsage]);

  // Listen for WebSocket messages
  useEffect(() => {
    const ws = wsRef?.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === 'sessions' && msg.data) {
          // Cancel the sessions timeout
          if (sessionsTimeoutRef.current) {
            clearTimeout(sessionsTimeoutRef.current);
            sessionsTimeoutRef.current = null;
          }

          const sessions: any[] = msg.data.sessions || [];
          // Single-pass matching: prefer exact key, then prefix, then substring
          const agentSession = sessions.find((s: any) => {
            const key: string = s.key ?? '';
            return key === `agent:${agentId}:main` ||
              key.startsWith(`agent:${agentId}:`) ||
              key.includes(`agent:${agentId}`);
          });

          if (agentSession) {
            setTotalTokens(typeof agentSession.totalTokens === 'number' ? agentSession.totalTokens : null);
            if (typeof agentSession.modelContextWindow === 'number') {
              const ctxWindow = agentSession.modelContextWindow;
              setModelContextWindow(ctxWindow);
              setIsUnlimited(ctxWindow === 0);
            }
            setError(null);
          }
          setIsLoading(false);

        } else if (msg.type === 'gateway.call.response') {
          const pending = pendingStatusRef.current;
          if (pending && msg.requestId === pending.requestId) {
            clearTimeout(pending.timeoutId);
            pendingStatusRef.current = null;
            if (typeof msg.result?.modelContextWindow === 'number') {
              const ctxWindow = msg.result.modelContextWindow;
              setModelContextWindow(ctxWindow);
              setIsUnlimited(ctxWindow === 0);
            }
          }

        } else if (msg.type === 'gateway.call.error') {
          const pending = pendingStatusRef.current;
          if (pending && msg.requestId === pending.requestId) {
            clearTimeout(pending.timeoutId);
            pendingStatusRef.current = null;
            // Status errors are non-fatal; session data alone is sufficient
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [wsRef, agentId]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (pendingStatusRef.current) clearTimeout(pendingStatusRef.current.timeoutId);
      if (sessionsTimeoutRef.current) clearTimeout(sessionsTimeoutRef.current);
    };
  }, []);

  return { totalTokens, modelContextWindow, isUnlimited, isLoading, error };
}

