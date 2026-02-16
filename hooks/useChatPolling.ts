import { useCallback, useEffect, useRef } from 'react';

// Constants - Adaptive polling intervals
const POLL_INTERVALS = {
  ACTIVE: 1000,      // When receiving frequent events (1 second)
  IDLE: 2000,        // When no activity for 5s (2 seconds)
  BACKGROUND: 5000   // When panel is inactive (5 seconds)
};
const POLL_COOLDOWN_MS = POLL_INTERVALS.ACTIVE * 2; // Timeout for race condition guard (2x active interval)
const ACTIVITY_THRESHOLD_MS = 5000; // 5 seconds of inactivity to transition to IDLE

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
  /** Whether this panel is currently active/focused */
  isActivePanel?: boolean;
}

/**
 * Activity state for tracking polling behavior
 */
interface ActivityState {
  lastEventTime: number;
  eventCount: number;
  isActive: boolean;
}

/**
 * Hook for polling chat history during active agent runs.
 * 
 * This hook implements per-panel isolated polling with adaptive intervals that:
 * - Only polls when the agent has an active run
 * - Fetches minimal data (last 10 messages) to reduce bandwidth
 * - Uses race condition guards to prevent overlapping requests
 * - Adjusts polling frequency based on activity and panel focus
 * - Automatically cleans up on unmount or run end
 * 
 * Polling Intervals:
 * - ACTIVE (1s): When receiving frequent events and panel is focused
 * - IDLE (2s): When no activity for 5+ seconds
 * - BACKGROUND (5s): When panel is not focused/active
 * 
 * @example
 * ```tsx
 * const { isPolling, trackActivity } = useChatPolling({
 *   agentId: 'agent-123',
 *   activeRunId: activeRuns['agent-123'],
 *   sendMessage: websocketSendFunction,
 *   isActivePanel: true,
 * });
 * 
 * // Signal activity when new messages arrive
 * useEffect(() => {
 *   if (chatHistory.length > 0) {
 *     trackActivity();
 *   }
 * }, [chatHistory.length, trackActivity]);
 * ```
 * 
 * @param config - Configuration object
 * @returns Object containing polling state and activity tracking function
 */
export function useChatPolling({ 
  agentId, 
  activeRunId, 
  sendMessage,
  isActivePanel = true 
}: PollConfig): { isPolling: boolean; trackActivity: () => void } {
  // Isolated state per hook instance
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendMessageRef = useRef(sendMessage);
  const isCleanedUpRef = useRef<boolean>(false);
  const activityRef = useRef<ActivityState>({
    lastEventTime: Date.now(),
    eventCount: 0,
    isActive: true
  });

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  /**
   * Track activity from parent component (when new messages arrive)
   */
  const trackActivity = useCallback(() => {
    activityRef.current = {
      lastEventTime: Date.now(),
      eventCount: activityRef.current.eventCount + 1,
      isActive: true
    };
    
    if (DEBUG) {
      console.log(`[ChatPolling] Activity tracked for ${agentId} (count: ${activityRef.current.eventCount})`);
    }
  }, [agentId]);

  /**
   * Determine current interval based on activity and panel state
   */
  const getCurrentInterval = useCallback((): number => {
    const { lastEventTime } = activityRef.current;
    const timeSinceLastEvent = Date.now() - lastEventTime;

    // Slow down polling for inactive/background panels
    if (!isActivePanel) {
      if (DEBUG) {
        console.log(`[ChatPolling] ${agentId} is in background - using BACKGROUND interval (${POLL_INTERVALS.BACKGROUND}ms)`);
      }
      return POLL_INTERVALS.BACKGROUND;
    }

    // Active panel: adjust based on recent activity
    if (timeSinceLastEvent < ACTIVITY_THRESHOLD_MS) {
      if (DEBUG) {
        console.log(`[ChatPolling] ${agentId} has recent activity - using ACTIVE interval (${POLL_INTERVALS.ACTIVE}ms)`);
      }
      return POLL_INTERVALS.ACTIVE;
    }

    // No recent activity
    if (DEBUG) {
      console.log(`[ChatPolling] ${agentId} is idle - using IDLE interval (${POLL_INTERVALS.IDLE}ms)`);
    }
    return POLL_INTERVALS.IDLE;
  }, [agentId, isActivePanel]);

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
      sendMessageRef.current({
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
  }, [agentId]);

  useEffect(() => {
    // Only poll when this agent has an active run
    if (!activeRunId) {
      if (DEBUG) {
        console.log(`[ChatPolling] No active run for ${agentId} - stopping polling`);
      }
      // Clear interval if it exists
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isPollingRef.current = false;
      isCleanedUpRef.current = false;
      return;
    }

    if (DEBUG) {
      console.log(`[ChatPolling] Starting adaptive polling for ${agentId} (runId: ${activeRunId})`);
    }

    // Reset cleanup flag when starting polling
    isCleanedUpRef.current = false;

    const schedulePoll = () => {
      if (isCleanedUpRef.current) return;
      
      pollHistory();
      
      // Check again after poll completes in case cleanup happened during poll
      if (isCleanedUpRef.current) return;
      
      // Schedule next poll with adaptive interval
      const interval = getCurrentInterval();
      intervalRef.current = setTimeout(() => {
        if (!isCleanedUpRef.current) {
          schedulePoll();
        }
      }, interval);
    };

    // Start first poll immediately
    schedulePoll();

    // Cleanup on unmount or when run ends
    return () => {
      isCleanedUpRef.current = true;
      if (DEBUG) {
        console.log(`[ChatPolling] Cleanup - stopping polling for ${agentId}`);
      }
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [agentId, activeRunId, isActivePanel, pollHistory, getCurrentInterval]);

  // Note: isPolling is a ref value and won't trigger re-renders when it changes.
  // This is intentional for now to avoid unnecessary re-renders. When UI indicators
  // are needed in the future, convert isPollingRef to useState.
  return { isPolling: isPollingRef.current, trackActivity };
}
