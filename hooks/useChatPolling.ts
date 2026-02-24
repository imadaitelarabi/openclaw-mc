import { useEffect, useRef } from "react";
import { globalChatPollingScheduler } from "./useGlobalChatPollingScheduler";

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
  /**
   * Whether this panel is currently visible/focused.
   * Visible panels are polled every 2s (high priority).
   * Background panels are polled every 30s (low priority).
   * Defaults to true.
   */
  isVisible?: boolean;
}

/**
 * Hook for polling chat history during active agent runs.
 *
 * Delegates to the module-level `globalChatPollingScheduler` so that all open
 * panels share a single timer.  Visible panels are polled every 2 s; background
 * panels every 30 s.  Chat history is the sole source of truth — no streaming.
 *
 * @param config - Configuration object
 */
export function useChatPolling({
  agentId,
  activeRunId,
  sendMessage,
  isVisible = true,
}: PollConfig): void {
  // Keep a stable ref so the scheduler always calls the latest sendMessage
  // without needing to re-register on every render.
  const sendMessageRef = useRef(sendMessage);

  // Sync the ref and notify the scheduler whenever sendMessage changes.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    globalChatPollingScheduler.updateSendMessage(agentId, (msg) =>
      sendMessageRef.current(msg)
    );
  }, [agentId, sendMessage]);

  // Propagate visibility changes to the scheduler (affects polling priority).
  useEffect(() => {
    globalChatPollingScheduler.setVisible(agentId, isVisible);
  }, [agentId, isVisible]);

  // Register / unregister with the scheduler based on whether a run is active.
  useEffect(() => {
    if (!activeRunId) {
      globalChatPollingScheduler.unregister(agentId);
      return;
    }

    // Wrap through ref so the scheduler always invokes the latest function.
    globalChatPollingScheduler.register(
      agentId,
      (msg) => sendMessageRef.current(msg),
      isVisible
    );

    return () => {
      globalChatPollingScheduler.unregister(agentId);
    };
    // isVisible is intentionally omitted: the separate setVisible effect keeps
    // the scheduler in sync without causing re-registration on focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, activeRunId]);
}
