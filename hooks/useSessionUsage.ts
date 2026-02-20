import { useEffect, useState, useCallback, useRef } from 'react';

export interface SessionUsage {
  totalTokens: number | null;
  modelContextWindow: number | null;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousRunIdRef = useRef<string | null>(null);

  const fetchUsage = useCallback(() => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setIsLoading(true);
    ws.send(JSON.stringify({ type: 'sessions.list' }));
  }, [wsRef]);

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
          const sessions: any[] = msg.data.sessions || [];
          const agentSession = sessions.find((s: any) =>
            s.key?.includes(`agent:${agentId}`)
          );
          if (agentSession) {
            setTotalTokens(typeof agentSession.totalTokens === 'number' ? agentSession.totalTokens : null);
            if (typeof agentSession.modelContextWindow === 'number') {
              setModelContextWindow(agentSession.modelContextWindow);
            }
            setError(null);
          }
          setIsLoading(false);
        } else if (msg.type === 'status' && typeof msg.modelContextWindow === 'number') {
          setModelContextWindow(msg.modelContextWindow);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [wsRef, agentId]);

  return { totalTokens, modelContextWindow, isLoading, error };
}
