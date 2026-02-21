import { useEffect, useState, useCallback, useRef } from "react";

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
  connectionStatus?: string;
}

export function useSessionUsage({
  wsRef,
  agentId,
  activeRunId,
  connectionStatus,
}: UseSessionUsageProps): SessionUsage {
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [modelContextWindow, setModelContextWindow] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousRunIdRef = useRef<string | null>(null);
  const pendingStatusRef = useRef<{
    requestId: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const sessionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseContextWindow = useCallback((session: any, defaults?: any): number | null => {
    const fromSession = session?.modelContextWindow ?? session?.contextTokens;
    if (typeof fromSession === "number") return fromSession;

    const fromDefaults = defaults?.modelContextWindow ?? defaults?.contextTokens;
    if (typeof fromDefaults === "number") return fromDefaults;

    return null;
  }, []);

  const parseTotalTokens = useCallback((session: any): number | null => {
    if (typeof session?.totalTokens === "number") return session.totalTokens;
    if (typeof session?.inputTokens === "number" && typeof session?.outputTokens === "number") {
      return session.inputTokens + session.outputTokens;
    }
    return null;
  }, []);

  const findAgentSession = useCallback((sessions: any[], currentAgentId: string) => {
    const exactKey = `agent:${currentAgentId}:main`;

    const exact = sessions.find((session: any) => session?.key === exactKey);
    if (exact) return exact;

    const prefix = sessions.find((session: any) => {
      const key: string = session?.key ?? "";
      return key.startsWith(`agent:${currentAgentId}:`);
    });
    if (prefix) return prefix;

    const guardedContains = sessions.find((session: any) => {
      const key: string = session?.key ?? "";
      return key.includes(`agent:${currentAgentId}:`) || key.endsWith(`:${currentAgentId}`);
    });
    if (guardedContains) return guardedContains;

    return null;
  }, []);

  const fetchStatus = useCallback(() => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Cancel previous pending status request
    if (pendingStatusRef.current) {
      clearTimeout(pendingStatusRef.current.timeoutId);
    }

    const requestId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timeoutId = setTimeout(() => {
      pendingStatusRef.current = null;
      // Status timeout is non-fatal — don't surface error if sessions data loaded
    }, REQUEST_TIMEOUT_MS);

    pendingStatusRef.current = { requestId, timeoutId };
    ws.send(JSON.stringify({ type: "gateway.call", method: "status", params: {}, requestId }));
  }, [wsRef]);

  const fetchUsage = useCallback(() => {
    const ws = wsRef?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setIsLoading(false);
      setError("Not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Set a timeout to surface an error if sessions.list never responds
    if (sessionsTimeoutRef.current) clearTimeout(sessionsTimeoutRef.current);
    sessionsTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setError("Usage unavailable");
    }, REQUEST_TIMEOUT_MS);

    ws.send(JSON.stringify({ type: "sessions.list" }));
    fetchStatus();
  }, [wsRef, fetchStatus]);

  // Fetch on mount/agent change and when connection becomes active
  useEffect(() => {
    if (connectionStatus && connectionStatus !== "connected") {
      return;
    }
    fetchUsage();
  }, [agentId, fetchUsage, connectionStatus]);

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

        if (msg.type === "sessions" && msg.data) {
          // Cancel the sessions timeout
          if (sessionsTimeoutRef.current) {
            clearTimeout(sessionsTimeoutRef.current);
            sessionsTimeoutRef.current = null;
          }

          const sessions: any[] = msg.data.sessions || [];
          const agentSession = findAgentSession(sessions, agentId);

          if (agentSession) {
            const tokens = parseTotalTokens(agentSession);
            const ctxWindow = parseContextWindow(agentSession, msg.data.defaults);

            setTotalTokens(tokens);
            setModelContextWindow(ctxWindow);
            setIsUnlimited(ctxWindow === 0);
            setError(null);
          }
          setIsLoading(false);
        } else if (msg.type === "gateway.call.response") {
          const pending = pendingStatusRef.current;
          if (pending && msg.requestId === pending.requestId) {
            clearTimeout(pending.timeoutId);
            pendingStatusRef.current = null;
            if (typeof msg.result?.modelContextWindow === "number") {
              const ctxWindow = msg.result.modelContextWindow;
              setModelContextWindow(ctxWindow);
              setIsUnlimited(ctxWindow === 0);
            }
          }
        } else if (msg.type === "gateway.call.error") {
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

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [wsRef, agentId, connectionStatus, parseContextWindow, parseTotalTokens, findAgentSession]);

  // Cleanup pending timers on unmount
  useEffect(() => {
    return () => {
      if (pendingStatusRef.current) clearTimeout(pendingStatusRef.current.timeoutId);
      if (sessionsTimeoutRef.current) clearTimeout(sessionsTimeoutRef.current);
    };
  }, []);

  return { totalTokens, modelContextWindow, isUnlimited, isLoading, error };
}
