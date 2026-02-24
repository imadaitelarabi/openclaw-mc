import { Loader2 } from "lucide-react";

interface ChatHistoryLoaderProps {
  agentId: string;
  loading: boolean;
  onLoadMore: () => void;
  disabled?: boolean;
}

/**
 * ChatHistoryLoader - Button to load older chat messages
 * Appears at the top of the chat history when scrolled up
 */
export function ChatHistoryLoader({
  agentId: _agentId,
  loading,
  onLoadMore,
  disabled = false,
}: ChatHistoryLoaderProps) {
  return (
    <div className="flex items-center justify-center py-3 px-4">
      <button
        onClick={onLoadMore}
        disabled={loading || disabled}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading history...</span>
          </>
        ) : (
          <>
            <span>↑</span>
            <span>Load older messages</span>
          </>
        )}
      </button>
    </div>
  );
}
