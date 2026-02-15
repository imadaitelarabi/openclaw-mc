import type { ChatMessage } from '@/types';
import { ToolCard } from './ToolCard';
import { ReasoningCard } from './ReasoningCard';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  if (message.role === 'tool') {
    return (
      <div className="flex flex-col items-start">
        <ToolCard message={message} />
      </div>
    );
  }

  if (message.role === 'reasoning') {
    return (
      <div className="flex flex-col items-start">
        <ReasoningCard message={message} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full overflow-hidden ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[95%] sm:max-w-[85%] rounded-lg p-3 md:p-4 ${
        message.role === 'user' 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-secondary/80 backdrop-blur'
      }`}>
        <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed break-words">
          {message.content}
        </div>
        {message.thinking && (
          <details className="mt-3 pt-3 border-t border-white/10">
            <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
              💭 Thinking (deprecated)
            </summary>
            <div className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
              {message.thinking}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
