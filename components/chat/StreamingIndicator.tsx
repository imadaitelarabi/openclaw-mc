import { ReasoningCard } from "./ReasoningCard";

interface StreamingIndicatorProps {
  assistantStream?: string;
  reasoningStream?: string;
  isTyping?: boolean;
}

export function StreamingIndicator({
  assistantStream,
  reasoningStream,
  isTyping,
}: StreamingIndicatorProps) {
  if (!assistantStream && !reasoningStream && !isTyping) return null;

  return (
    <>
      {reasoningStream && (
        <div className="flex flex-col items-start">
          <ReasoningCard
            message={{
              id: "streaming",
              role: "reasoning",
              content: reasoningStream,
              timestamp: Date.now(),
            }}
            isStreaming
          />
        </div>
      )}

      {assistantStream && (
        <div className="flex flex-col items-start">
          <div className="max-w-[85%] rounded-lg p-4 bg-secondary/60 backdrop-blur border border-secondary text-foreground">
            <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed opacity-90">
              {assistantStream}
              <span className="inline-block w-2 h-4 ml-1 bg-foreground/50 animate-pulse">▊</span>
            </div>
          </div>
        </div>
      )}

      {isTyping && !assistantStream && !reasoningStream && (
        <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-[85%] rounded-lg p-4 bg-secondary/40 backdrop-blur border border-secondary flex gap-1 items-center h-[44px]">
            <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </>
  );
}
