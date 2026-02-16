import { useCallback, useEffect, useRef } from 'react';

/**
 * Configuration for the polling hook
 */
interface PollConfig {
  /** Agent ID to poll history for */
  agentId: string;
  /** Current active run ID (null if no run is active) */
  activeRunId: string | null;
  /** Function to send messages to the Gateway */
  sendMessage: (msg: Record<string, unknown>) => void;
}

/**
 * Hook for polling chat history during active agent runs.
 * 
 * This hook implements per-panel isolated polling that:
 * - Only polls when the agent has an active run
 * - Fetches minimal data (last 10 messages) to reduce bandwidth
 * - Uses race condition guards to prevent overlapping requests
 * - Automatically cleans up on unmount or run end
 * 
 * @example
 * ```tsx
 * const { isPolling } = useChatPolling({
 *   agentId: 'agent-123',
 *   activeRunId: activeRuns['agent-123'],
 *   sendMessage: websocketSendFunction,
 * });
 * ```
 * 
 * @param config - Configuration object
 * @returns Object containing polling state
 */
export function useChatPolling({ agentId, activeRunId, sendMessage }: PollConfig) {
  // Isolated state per hook instance
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const lastSeenIdRef = useRef<string | null>(null);

  /**
   * Poll chat history for reasoning blocks and enriched tool calls
   */
  const pollHistory = useCallback(() => {
    // Race condition guard - prevent overlapping polls
    if (isPollingRef.current) {
      return;
    }
    
    isPollingRef.current = true;

    // Request minimal data (last 10 messages)
    sendMessage({
      type: 'chat.history.load',
      agentId,
      params: {
        sessionKey: `agent:${agentId}:main`,
        limit: 10, // Minimal fetch to reduce bandwidth
      },
    });

    // Reset flag after response window
    // This allows the next poll to proceed
    setTimeout(() => {
      isPollingRef.current = false;
    }, 1000);
  }, [agentId, sendMessage]);

  useEffect(() => {
    // Only poll when this agent has an active run
    if (!activeRunId) {
      // Clear interval if it exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling immediately, then every 500ms
    pollHistory();
    intervalRef.current = setInterval(pollHistory, 500);

    // Cleanup on unmount or when run ends
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [agentId, activeRunId, pollHistory]);

  return {
    /** Whether this hook is currently polling */
    isPolling: isPollingRef.current,
  };
}
