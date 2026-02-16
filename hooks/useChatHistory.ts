import { useCallback, useState } from 'react';

interface UseChatHistoryProps {
  sendMessage: (message: Record<string, unknown>) => void;
}

// Constants
const DEFAULT_HISTORY_PAGE_SIZE = 50;
const HISTORY_LOAD_TIMEOUT_MS = 5000;

export function useChatHistory({ sendMessage }: UseChatHistoryProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  /**
   * Load more chat history for a specific agent
   * Uses a custom message type that will be forwarded to the Gateway
   * @param agentId - Agent ID
   * @param limit - Number of messages to fetch (default: 50)
   * @param before - Message ID to paginate from (optional)
   */
  const loadMoreHistory = useCallback(
    (agentId: string, limit: number = DEFAULT_HISTORY_PAGE_SIZE, before?: string) => {
      setLoading((prev) => ({ ...prev, [agentId]: true }));

      try {
        const sessionKey = `agent:${agentId}:main`;
        const params: Record<string, unknown> = {
          sessionKey,
          limit,
        };

        if (before) {
          params.before = before;
        }

        // Send request to load more history
        // This will be handled by the server and result in a chat_history_more event
        sendMessage({
          type: 'chat.history.load',
          agentId,
          params,
        });
      } catch (err) {
        console.error(`[ChatHistory] Failed to load more history for ${agentId}:`, err);
        setLoading((prev) => ({ ...prev, [agentId]: false }));
      }

      // Reset loading state after a timeout as fallback
      setTimeout(() => {
        setLoading((prev) => ({ ...prev, [agentId]: false }));
      }, HISTORY_LOAD_TIMEOUT_MS);
    },
    [sendMessage]
  );

  return {
    loading,
    loadMoreHistory,
  };
}
