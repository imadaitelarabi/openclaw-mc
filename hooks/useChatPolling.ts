import { useEffect, useRef } from "react";

// Fixed polling interval during active agent runs
const POLL_INTERVAL_MS = 2000;
const POLL_COOLDOWN_MS = POLL_INTERVAL_MS; // Timeout for race condition guard

// Debug flag for development/troubleshooting
// Next.js inlines NEXT_PUBLIC_* env vars at build time, so this check works in browser
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_POLLING === "true";

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
 * Polls chat history every 2s while an agent run is active.
 * Chat history is the sole source of truth — no live streaming.
 * Stops automatically when the run ends or the component unmounts.
 *
 * @param config - Configuration object
 * @returns Object containing polling state
 */
export function useChatPolling({
  agentId,
  activeRunId,
  sendMessage,
}: PollConfig): { isPolling: boolean } {
  // Isolated state per hook instance
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendMessageRef = useRef(sendMessage);
  const isCleanedUpRef = useRef<boolean>(false);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    // Only poll when this agent has an active run
    if (!activeRunId) {
      if (DEBUG) {
        console.log(`[ChatPolling] No active run for ${agentId} - stopping polling`);
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
      isPollingRef.current = false;
      isCleanedUpRef.current = false;
      return;
    }

    if (DEBUG) {
      console.log(`[ChatPolling] Starting polling for ${agentId} (runId: ${activeRunId})`);
    }

    isCleanedUpRef.current = false;

    const pollHistory = () => {
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
        sendMessageRef.current({
          type: "chat.history.load",
          agentId,
          params: {
            sessionKey: `agent:${agentId}:main`,
            limit: 10,
          },
        });
      } catch (err) {
        if (DEBUG) {
          console.error(`[ChatPolling] Error sending poll request for ${agentId}:`, err);
        }
        isPollingRef.current = false;
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = null;
        }
        return;
      }

      cooldownTimeoutRef.current = setTimeout(() => {
        isPollingRef.current = false;
        if (DEBUG) {
          console.log(`[ChatPolling] Poll cooldown complete for ${agentId}`);
        }
      }, POLL_COOLDOWN_MS);
    };

    const schedulePoll = () => {
      if (isCleanedUpRef.current) return;

      pollHistory();

      if (isCleanedUpRef.current) return;

      pollTimeoutRef.current = setTimeout(() => {
        if (!isCleanedUpRef.current) {
          schedulePoll();
        }
      }, POLL_INTERVAL_MS);
    };

    // Start first poll immediately
    schedulePoll();

    // Cleanup on unmount or when run ends
    return () => {
      isCleanedUpRef.current = true;
      if (DEBUG) {
        console.log(`[ChatPolling] Cleanup - stopping polling for ${agentId}`);
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [agentId, activeRunId]);

  return { isPolling: isPollingRef.current };
}
