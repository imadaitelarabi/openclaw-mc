import { useCallback, useEffect, useRef } from 'react';

// Constants
const POLL_INTERVAL_MS = 500;
const POLL_COOLDOWN_MS = POLL_INTERVAL_MS * 2; // Timeout for race condition guard (2x interval)

// Debug flag for development/troubleshooting
// Next.js inlines NEXT_PUBLIC_* env vars at build time, so this check works in browser
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_POLLING === 'true';

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
export function useChatPolling({ agentId, activeRunId, sendMessage }: PollConfig): { isPolling: boolean } {
  // Isolated state per hook instance
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Poll chat history for reasoning blocks and enriched tool calls
   */
  const pollHistory = useCallback(() => {
    // Race condition guard - prevent overlapping polls
    if (isPollingRef.current) {
      if (DEBUG) {
        console.log(`[ChatPolling] Skipping poll for ${agentId} - request already in flight`);
      }
      return;
    }
    
    isPollingRef.current = true;

    if (DEBUG) {
      console.log(`[ChatPolling] Polling ${agentId} - fetching last 10 messages`);
    }

    try {
      // Request minimal data (last 10 messages)
      sendMessage({
        type: 'chat.history.load',
        agentId,
        params: {
          sessionKey: `agent:${agentId}:main`,
          limit: 10, // Minimal fetch to reduce bandwidth
        },
      });
    } catch (err) {
      if (DEBUG) {
        console.error(`[ChatPolling] Error sending poll request for ${agentId}:`, err);
      }
      // Reset flag immediately on error to allow next poll
      isPollingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Reset flag after response window
    // This allows the next poll to proceed
    timeoutRef.current = setTimeout(() => {
      isPollingRef.current = false;
      if (DEBUG) {
        console.log(`[ChatPolling] Poll cooldown complete for ${agentId}`);
      }
    }, POLL_COOLDOWN_MS);
  }, [agentId, sendMessage]);

  useEffect(() => {
    // Only poll when this agent has an active run
    if (!activeRunId) {
      if (DEBUG) {
        console.log(`[ChatPolling] No active run for ${agentId} - stopping polling`);
      }
      // Clear interval if it exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (DEBUG) {
      console.log(`[ChatPolling] Starting polling for ${agentId} (runId: ${activeRunId})`);
    }

    // Start polling immediately, then every 500ms
    pollHistory();
    intervalRef.current = setInterval(pollHistory, POLL_INTERVAL_MS);

    // Cleanup on unmount or when run ends
    return () => {
      if (DEBUG) {
        console.log(`[ChatPolling] Cleanup - stopping polling for ${agentId}`);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // pollHistory is intentionally excluded to avoid unnecessary interval restarts
    // when sendMessage reference changes. The latest sendMessage will be captured
    // by the pollHistory closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, activeRunId]);

  // Note: isPolling is a ref value and won't trigger re-renders when it changes.
  // This is intentional for now to avoid unnecessary re-renders. When UI indicators
  // are needed in the future, convert isPollingRef to useState.
  return { isPolling: isPollingRef.current };
}
