import type { ChatMessage } from '@/types';
import { Brain } from 'lucide-react';

interface ReasoningCardProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ReasoningCard({ message, isStreaming = false }: ReasoningCardProps) {
  return (
    <div className="max-w-[85%] rounded-lg p-4 bg-purple-500/10 border border-purple-500/30 backdrop-blur">
      <div className="flex items-center gap-2 mb-2">
        {isStreaming && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
        <Brain className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
        <span className="text-xs font-mono text-purple-700 dark:text-purple-300 font-semibold">
          {isStreaming ? 'Reasoning...' : 'Reasoning'}
        </span>
      </div>
      <details open={!isStreaming} className="mt-2">
        <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground mb-2">
          Thinking process
        </summary>
        <div className="text-sm whitespace-pre-wrap text-purple-100 dark:text-purple-200 leading-relaxed">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse">▊</span>
          )}
        </div>
      </details>
    </div>
  );
}
